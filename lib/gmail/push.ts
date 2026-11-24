import "server-only";
import type { gmail_v1 } from "googleapis";
import { createGmailClient } from "@/lib/gmail/client";
import { GMAIL_BASE_QUERY } from "@/lib/gmail/config";
import { resolveParser } from "@/lib/gmail/parsers";
import { createGmailPreview } from "@/lib/gmail/preview";
import { extractMessageMeta } from "@/lib/gmail/sync";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
export const PUSH_CONNECTION_FIELDS = "id,user_id,email_address,status,sync_cursor,push_history_id,push_watch_expires_at,push_last_success_at" as const;
export type PushConnection = {
  id: string; user_id: string; email_address: string; status: string;
  sync_cursor: string | null; push_history_id: string | null;
  push_watch_expires_at: string | null; push_last_success_at: string | null;
};
const DAY = 86400000;
const MAX_PAGES = 20;
const MAX_IDS = 500;
function missing(e: unknown) {
  const err = e as { code?: number | string; response?: { status?: number } } | null;
  return err?.code === 404 || err?.code === "404" || err?.response?.status === 404;
}
export function pushConfigured() {
  return !!(process.env.GMAIL_PUSH_TOPIC && process.env.GMAIL_PUSH_SUBSCRIPTION &&
    process.env.GMAIL_PUSH_AUDIENCE && process.env.GMAIL_PUSH_SERVICE_ACCOUNT);
}

async function stillActive(db: Db, row: PushConnection) {
  const { data, error } = await db.from("email_connections").select("id")
    .eq("id", row.id).eq("user_id", row.user_id).eq("status", "active")
    .eq("email_address", row.email_address).maybeSingle();
  if (error || !data) throw new Error("Gmail connection changed");
}
async function ingest(db: Db, row: PushConnection, gmail: gmail_v1.Gmail, id: string) {
  const { data: existing, error } = await db.from("email_imports").select("id")
    .eq("user_id", row.user_id).eq("gmail_message_id", id).maybeSingle();
  if (error) throw new Error("Gmail dedup lookup failed");
  if (existing) return;
  await stillActive(db, row);
  let message: gmail_v1.Schema$Message;
  try {
    const response = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "Subject"] });
    message = response.data;
    if ((message.labelIds ?? []).some(label => ["SPAM", "TRASH", "CHAT", "SENT", "DRAFT"].includes(label))) return;
    const headers = message.payload?.headers ?? [];
    const from = headers.find(h => h.name?.toLowerCase() === "from")?.value ?? "";
    const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value ?? "";
    const parser = resolveParser(from);
    if (!parser || (parser.source === "grab" && subject.trim().toLowerCase() !== "your grab e-receipt")) return;
    message = (await gmail.users.messages.get({ userId: "me", id, format: "full" })).data;
  } catch (e) { if (missing(e)) return; throw e; }
  const meta = extractMessageMeta(message);
  const parser = resolveParser(meta.from);
  if (!parser) return;
  const result = parser.parse({ subject: meta.subject, from: meta.from, bodyText: meta.bodyText, receivedAt: meta.receivedAtIso });
  const pending = result.ok && result.amount !== null;
  await stillActive(db, row);
  const { error: insertError } = await db.from("email_imports").insert({
    user_id: row.user_id, connection_id: row.id, gmail_message_id: id,
    gmail_thread_id: meta.threadId, subject: meta.subject || null, sender: meta.from || null,
    received_at: meta.receivedAtIso, status: pending ? "pending" : "failed",
    failure_reason: pending ? null : "Tidak ada nominal yang bisa dibaca dari email ini.",
    parsed_preview: createGmailPreview(parser.source, result),
  });
  if (insertError && insertError.code !== "23505") throw new Error("Gmail draft insert failed");
}

async function historyIds(gmail: gmail_v1.Gmail, startHistoryId: string) {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await gmail.users.history.list({ userId: "me", startHistoryId, historyTypes: ["messageAdded"], maxResults: 100, pageToken });
    for (const history of data.history ?? []) for (const item of history.messagesAdded ?? []) {
      if (item.message?.id) ids.add(item.message.id);
    }
    if (ids.size > MAX_IDS) throw new Error("Gmail history backlog exceeds safe batch");
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken && data.historyId && /^\d+$/.test(data.historyId)) return { ids, cursor: data.historyId };
    if (!pageToken) throw new Error("Missing Gmail history cursor");
  }
  throw new Error("Gmail history pagination exceeds safe batch");
}

async function catchUp(gmail: gmail_v1.Gmail, row: PushConnection, startedAt: number) {
  // Initial import: use existing manual cursor, otherwise seven days.
  // Expired history: overlap the last successful push sync by one day.
  const previous = Date.parse(row.push_last_success_at ?? row.sync_cursor ?? "");
  const after = Math.floor((Number.isFinite(previous) ? previous - DAY : startedAt - 7 * DAY) / 1000);
  const ids = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await gmail.users.messages.list({ userId: "me", q: GMAIL_BASE_QUERY + " after:" + after, maxResults: 100, pageToken });
    for (const message of data.messages ?? []) if (message.id) ids.add(message.id);
    if (ids.size > MAX_IDS) throw new Error("Gmail recovery backlog exceeds safe batch");
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken) return ids;
  }
  throw new Error("Gmail recovery pagination exceeds safe batch");
}

// Called only from authenticated backend routes or the user's own OAuth callback.
export async function syncPushConnection(db: Db, row: PushConnection, renew = false) {
  if (!pushConfigured() || row.status !== "active") return;
  const startedAt = Date.now();
  await stillActive(db, row);
  const gmail = await createGmailClient(db, row.user_id, row.id);
  const { data: profile } = await gmail.users.getProfile({ userId: "me" });
  if (profile.emailAddress?.toLowerCase() !== row.email_address.toLowerCase() ||
      !profile.historyId || !/^\d+$/.test(profile.historyId)) throw new Error("Gmail mailbox mismatch");
  let expiration = row.push_watch_expires_at;
  let snapshot = profile.historyId;
  if (renew || !expiration || Date.parse(expiration) < startedAt + DAY) {
    const { data: watch } = await gmail.users.watch({ userId: "me", requestBody: { topicName: process.env.GMAIL_PUSH_TOPIC! } });
    if (!watch.historyId || !/^\d+$/.test(watch.historyId) || !watch.expiration || !Number.isFinite(Number(watch.expiration))) throw new Error("Invalid Gmail watch response");
    expiration = new Date(Number(watch.expiration)).toISOString();
    snapshot = watch.historyId;
  }
  let batch: { ids: Set<string>; cursor: string };
  if (row.push_history_id) {
    try { batch = await historyIds(gmail, row.push_history_id); }
    catch (e) {
      if (!missing(e)) throw e;
      batch = { ids: await catchUp(gmail, row, startedAt), cursor: snapshot };
    }
  } else {
    batch = { ids: await catchUp(gmail, row, startedAt), cursor: snapshot };
  }
  for (const id of batch.ids) await ingest(db, row, gmail, id);
  // Compare-and-set: a concurrent delivery cannot overwrite a newer cursor.
  // A lost race is retried by Pub/Sub, not acknowledged as a completed sync.
  let update = db.from("email_connections").update({
    push_history_id: batch.cursor, push_watch_expires_at: expiration,
    push_last_success_at: new Date(startedAt).toISOString(),
    last_synced_at: new Date().toISOString(), last_error: null,
  }).eq("id", row.id).eq("user_id", row.user_id).eq("email_address", row.email_address).eq("status", "active");
  update = row.push_history_id === null ? update.is("push_history_id", null) : update.eq("push_history_id", row.push_history_id);
  const { data, error } = await update.select("id").maybeSingle();
  if (error || !data) throw new Error("Gmail cursor update lost or failed");
}
