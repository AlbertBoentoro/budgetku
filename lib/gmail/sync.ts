import type { gmail_v1 } from "googleapis";

import { createGmailClient } from "@/lib/gmail/client";
import {
  GMAIL_BASE_QUERY,
  MAX_MESSAGES_PER_SYNC,
} from "@/lib/gmail/config";
import { resolveParser } from "@/lib/gmail/parsers";
import type { ParseResult } from "@/lib/gmail/parsers";
import type { createClient } from "@/lib/supabase/server";

/**
 * Server-only Gmail sync engine (design §4.3). Lists candidate messages via the
 * broad sender-domain query, dedups against email_imports with an explicit
 * select-then-write (NOT .upsert(), since no unique index exists on
 * email_imports(user_id, gmail_message_id) — BLOCKER-1), parses each new
 * message, and stores only honest metadata (never a fabricated amount).
 *
 * Never imported from a client bundle (pulls googleapis via lib/gmail/client).
 */

// Defense-in-depth only (see lib/crypto.ts for the real boundary rationale).
if (typeof window !== "undefined") {
  throw new Error("lib/gmail/sync.ts is server-only and must not run in the browser.");
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Milliseconds in one day; used to overlap the incremental `after:` cursor by a
// day so day-granular Gmail filtering never drops a boundary message (§4.3).
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface SyncResult {
  // Messages the Gmail list returned (before dedup), capped at the per-sync max.
  listed: number;
  // Rows newly inserted into email_imports this run (needs_review + failed).
  inserted: number;
  // Messages skipped because an email_imports row already existed.
  skipped: number;
  // True when the per-sync cap was hit (a backlog may remain; §4.3 step 7).
  capped: boolean;
}

/**
 * Run one manual sync for the given connection. The caller MUST pass the
 * authenticated user's id (from getUser(), never client input) and a
 * connection that belongs to that user; every read/write here is
 * `.eq("user_id", userId)`-scoped and fail-closed.
 */
export async function syncGmail(
  supabase: ServerSupabaseClient,
  userId: string,
  connection: { id: string; sync_cursor: string | null },
): Promise<SyncResult> {
  const gmail = await createGmailClient(supabase, userId, connection.id);

  const query = buildQuery(connection.sync_cursor);

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: MAX_MESSAGES_PER_SYNC,
  });

  const messages = list.data.messages ?? [];
  const capped = messages.length >= MAX_MESSAGES_PER_SYNC;

  let inserted = 0;
  let skipped = 0;
  // The newest received_at (epoch ms) across messages fully processed this run.
  let newestProcessedMs: number | null = null;

  for (const ref of messages) {
    const messageId = ref.id;
    if (!messageId) continue;

    // Dedup via select-then-write (NOT .upsert(); BLOCKER-1 has no conflict
    // target). An existing row in ANY status is left untouched — terminal
    // (imported/ignored), needs_review, and failed are all skipped so a manual
    // re-parse path can decide, and the overlap re-fetch stays cheap.
    const { data: existing, error: selectError } = await supabase
      .from("email_imports")
      .select("id, status")
      .eq("user_id", userId)
      .eq("gmail_message_id", messageId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Gagal memeriksa riwayat impor: ${selectError.message}`);
    }

    if (existing) {
      skipped += 1;
      continue;
    }

    const full = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const meta = extractMessageMeta(full.data);
    const receivedMs = meta.internalDateMs;
    if (receivedMs !== null) {
      newestProcessedMs =
        newestProcessedMs === null
          ? receivedMs
          : Math.max(newestProcessedMs, receivedMs);
    }

    const parser = resolveParser(meta.from);
    let status: "pending" | "failed";
    let failureReason: string | null = null;

    if (!parser) {
      status = "failed";
      failureReason = "Pengirim tidak dikenali untuk impor otomatis.";
    } else {
      const result = parser.parse({
        subject: meta.subject,
        from: meta.from,
        bodyText: meta.bodyText,
        receivedAt: meta.receivedAtIso,
      });
      if (result.ok && result.amount !== null) {
        status = "pending";
      } else {
        status = "failed";
        failureReason = "Tidak ada nominal yang bisa dibaca dari email ini.";
      }
    }

    // Store only honest metadata — no parsed amount is persisted (no column
    // exists; the review form re-parses on demand, design §6.4).
    const { error: insertError } = await supabase.from("email_imports").insert({
      user_id: userId,
      connection_id: connection.id,
      gmail_message_id: messageId,
      gmail_thread_id: meta.threadId,
      subject: meta.subject || null,
      sender: meta.from || null,
      received_at: meta.receivedAtIso,
      status,
      failure_reason: failureReason,
    });

    if (insertError) {
      // 23505 = unique violation on email_imports(user_id, gmail_message_id)
      // (docs/sql/2026-10-add-gmail-unique-indexes.sql): a concurrent sync
      // already stored this message, so count it as skipped, like the dedup
      // select above. Every other error still fails the sync.
      if (insertError.code === "23505") {
        skipped += 1;
        continue;
      }
      throw new Error(`Gagal menyimpan email impor: ${insertError.message}`);
    }

    inserted += 1;
  }

  // Advance the cursor conservatively (§4.3 step 7): only when the cap was NOT
  // hit (all matching messages fetched) do we move forward to the newest
  // processed received_at. When the cap WAS hit, leave the cursor so the next
  // manual sync resumes from the same overlap and never jumps past unfetched
  // older messages.
  const connectionUpdate: {
    last_synced_at: string;
    last_error: null;
    updated_at: string;
    sync_cursor?: string;
  } = {
    last_synced_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  if (!capped && newestProcessedMs !== null) {
    connectionUpdate.sync_cursor = new Date(newestProcessedMs).toISOString();
  }

  const { error: connError } = await supabase
    .from("email_connections")
    .update(connectionUpdate)
    .eq("id", connection.id)
    .eq("user_id", userId);

  if (connError) {
    throw new Error(`Gagal memperbarui status koneksi: ${connError.message}`);
  }

  return {
    listed: messages.length,
    inserted,
    skipped,
    capped,
  };
}

/**
 * Outcome of a lazy, single-draft re-parse when the user opens one draft
 * (design §4.4 step 2, §6.4). The candidate values are display-only and NEVER
 * persisted; the user confirms/corrects them in the review form.
 *   - ok:    the message was re-fetched and parsed; `candidate` holds the
 *            detected display values (any field may be null = not detected).
 *   - transient: a transient Gmail failure (token/rate-limit/5xx). The caller
 *            keeps the row needs_review and shows an honest retry message.
 *   - gone:  the message is permanently gone (404). The caller marks the row
 *            failed so the user can dismiss it or add it manually.
 */
export type ReparseOutcome =
  | { kind: "ok"; candidate: ParseResult }
  | { kind: "transient" }
  | { kind: "gone" };

/**
 * Re-fetch ONE message by gmail_message_id and re-parse it to populate the
 * review form (design §6.4: parsed candidate values are not persisted, they are
 * re-derived on demand). Server-only. The caller must pass the authenticated
 * user's id and a connection that belongs to that user.
 *
 * A permanent 404 maps to `gone`; any other failure maps to `transient` so the
 * draft is never auto-failed on a flaky network and no value is fabricated.
 */
export async function reparseDraftMessage(
  supabase: ServerSupabaseClient,
  userId: string,
  connectionId: string,
  gmailMessageId: string,
): Promise<ReparseOutcome> {
  let meta: MessageMeta;
  try {
    const gmail = await createGmailClient(supabase, userId, connectionId);
    const full = await gmail.users.messages.get({
      userId: "me",
      id: gmailMessageId,
      format: "full",
    });
    meta = extractMessageMeta(full.data);
  } catch (error) {
    if (isNotFound(error)) return { kind: "gone" };
    return { kind: "transient" };
  }

  const parser = resolveParser(meta.from);

  if (!parser) {
    // Unknown sender: honest empty candidate, nothing fabricated. The user can
    // still fill the form manually from the detected date/merchant (none here).
    return {
      kind: "ok",
      candidate: {
        ok: false,
        amount: null,
        direction: null,
        transactionAt: null,
        merchant: null,
        description: null,
        confidence: "low",
      },
    };
  }

  const candidate = parser.parse({
    subject: meta.subject,
    from: meta.from,
    bodyText: meta.bodyText,
    receivedAt: meta.receivedAtIso,
  });

  return { kind: "ok", candidate };
}

/** True only for a definitive Gmail 404 (message permanently gone). */
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybe = error as {
    code?: number | string;
    status?: number;
    response?: { status?: number };
  };
  return (
    maybe.code === 404 ||
    maybe.code === "404" ||
    maybe.status === 404 ||
    maybe.response?.status === 404
  );
}

/**
 * Build the Gmail list query. Appends an incremental `after:<epoch-seconds>`
 * derived from (sync_cursor day − 1 day) so day-granular filtering overlaps by
 * one day (§4.3 step 4); dedup absorbs the re-fetched overlap. With no cursor
 * (first sync) the broad base query runs unbounded (still capped by maxResults).
 */
function buildQuery(syncCursor: string | null): string {
  if (!syncCursor) return GMAIL_BASE_QUERY;

  const cursorMs = Date.parse(syncCursor);
  if (!Number.isFinite(cursorMs)) return GMAIL_BASE_QUERY;

  const afterSeconds = Math.floor((cursorMs - ONE_DAY_MS) / 1000);
  if (afterSeconds <= 0) return GMAIL_BASE_QUERY;

  return `${GMAIL_BASE_QUERY} after:${afterSeconds}`;
}

interface MessageMeta {
  subject: string;
  from: string;
  threadId: string | null;
  receivedAtIso: string;
  internalDateMs: number | null;
  bodyText: string;
}

/**
 * Pull the honest metadata and a decoded plain-text body out of a full Gmail
 * message. Prefers text/plain and falls back to tag-stripped text/html, as the
 * parsers expect already-decoded body text (FEAT-002 contract).
 */
function extractMessageMeta(message: gmail_v1.Schema$Message): MessageMeta {
  const headers = message.payload?.headers ?? [];
  const header = (name: string): string => {
    const found = headers.find(
      (h) => (h.name ?? "").toLowerCase() === name.toLowerCase(),
    );
    return found?.value ?? "";
  };

  const internalDateMs = message.internalDate
    ? Number(message.internalDate)
    : null;
  const receivedAtIso =
    internalDateMs !== null && Number.isFinite(internalDateMs)
      ? new Date(internalDateMs).toISOString()
      : new Date().toISOString();

  return {
    subject: header("Subject"),
    from: header("From"),
    threadId: message.threadId ?? null,
    receivedAtIso,
    internalDateMs:
      internalDateMs !== null && Number.isFinite(internalDateMs)
        ? internalDateMs
        : null,
    bodyText: decodeBody(message.payload),
  };
}

/** Decode a base64url Gmail body part to a UTF-8 string. */
function decodePart(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

/** Collapse HTML to rough plain text so the pure parsers get readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Walk the MIME tree and return the best decoded body text: prefer the first
 * text/plain part, else fall back to tag-stripped text/html. Returns "" when no
 * decodable body is found (the parser then marks the row needs_review/failed).
 */
function decodeBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): string {
  if (!payload) return "";

  const plain = findPart(payload, "text/plain");
  if (plain) return plain;

  const html = findPart(payload, "text/html");
  if (html) return htmlToText(html);

  return "";
}

/**
 * Depth-first search for the first part of `mimeType` with inline body data.
 * Returns the decoded string, or null when no such part exists.
 */
function findPart(
  part: gmail_v1.Schema$MessagePart,
  mimeType: string,
): string | null {
  if (
    (part.mimeType ?? "").toLowerCase() === mimeType &&
    part.body?.data
  ) {
    return decodePart(part.body.data);
  }

  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found !== null) return found;
  }

  return null;
}
