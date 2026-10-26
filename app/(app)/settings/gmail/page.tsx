import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { toGmailDateInputValue } from "@/lib/gmail/date-format";
import {
  fetchActiveAccounts,
  fetchUsableCategories,
} from "@/lib/transactions";
import { reparseDraftMessage } from "@/lib/gmail/sync";
import { readGmailPreview } from "@/lib/gmail/preview";
import { AppBackLink } from "@/components/layout/app-back-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { GmailConnectCard } from "@/components/finance/gmail-connect-card";
import { GmailConnectionPanel } from "@/components/finance/gmail-connection-panel";
import {
  GmailDraftList,
  type GmailReviewState,
} from "@/components/finance/gmail-draft-list";
import type { GmailDraftView } from "@/components/finance/gmail-draft-row";
import {
  GmailImportHistory,
  type GmailHistoryView,
} from "@/components/finance/gmail-import-history";
import {
  GmailLoading,
} from "@/app/(app)/settings/gmail/loading";

type SearchParams = Record<string, string | string[] | undefined>;

// Friendly, sanitized copy for each callback ?err= flag (design §11). The raw
// provider error never reaches the client; only these mapped strings do.
const CALLBACK_ERRORS: Record<string, string> = {
  denied:
    "Akses Gmail dibatalkan. Kamu bisa mencoba menghubungkan lagi kapan saja.",
  state: "Sesi penghubungan tidak valid. Coba hubungkan ulang.",
  exchange: "Gagal menyelesaikan koneksi ke Gmail. Coba lagi.",
  userinfo: "Gagal menyelesaikan koneksi ke Gmail. Coba lagi.",
  norefresh:
    "Google tidak memberikan izin akses lanjutan. Hapus akses Budgetku di Akun Google lalu hubungkan lagi.",
  persist: "Gagal menyimpan koneksi Gmail. Coba lagi.",
};

// Sanitized friendly copy for a stored connection last_error category. Never
// surfaces a raw provider error string.
function mapConnectionError(status: string, lastError: string | null): string {
  if (status === "error") {
    return (
      lastError ??
      "Koneksi Gmail kedaluwarsa atau dicabut. Hubungkan ulang untuk melanjutkan."
    );
  }
  return lastError ?? "";
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  if (typeof value === "string") return value.trim();
  return "";
}

export default function GmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <AppHeader
        title="Impor dari Gmail"
        titleAction={
          <AppBackLink href="/settings" label="Kembali ke Pengaturan" />
        }
      />
      <PageContainer className="pb-6">
        <Suspense fallback={<GmailLoading />}>
          <GmailContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function GmailContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;

  // Reading request state (cookies via getUser()) INSIDE the Suspense boundary
  // forces dynamic rendering under cacheComponents: true (design §12). This is
  // the dynamic-render mechanism, not revalidatePath.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the queries strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <GmailError message="Sesi berakhir. Silakan masuk kembali untuk mengelola impor Gmail." />
    );
  }

  const errFlag = firstValue(resolved.err);
  const okFlag = firstValue(resolved.ok);
  const reviewId = firstValue(resolved.review);
  const callbackError = errFlag ? CALLBACK_ERRORS[errFlag] : "";
  const justConnected = okFlag === "connected";

  // Load the single connection row (most recent updated_at is the current one).
  const { data: connection, error: connError } = await supabase
    .from("email_connections")
    .select("email_address, status, last_synced_at, last_error")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connError) {
    return (
      <GmailError message="Gagal memuat koneksi Gmail. Periksa koneksi lalu coba lagi." />
    );
  }

  const isConnected = Boolean(connection) && connection!.status === "active";
  const isConnectionError =
    Boolean(connection) && connection!.status === "error";

  // Not connected (no row, disconnected, or errored): show the connect card.
  // An errored connection also surfaces the honest reconnect message.
  if (!isConnected) {
    const connErrorMessage = connection
      ? mapConnectionError(connection.status, connection.last_error)
      : "";
    return (
      <div className="flex flex-col gap-6">
        <CallbackNotice error={callbackError} connected={false} />
        {isConnectionError && connErrorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
          >
            {connErrorMessage}
          </p>
        ) : null}
        <GmailConnectCard />
      </div>
    );
  }

  // Connected: load the import rows (needs_review + failed as drafts; imported +
  // ignored as history), all user-scoped from stored metadata only.
  const { data: imports, error: importsError } = await supabase
    .from("email_imports")
    .select(
      "id, subject, sender, received_at, processed_at, status, failure_reason, gmail_message_id, parsed_preview",
    )
    .eq("user_id", user.id)
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (importsError) {
    return (
      <GmailError message="Riwayat impor gagal dimuat. Periksa koneksi lalu coba lagi." />
    );
  }

  const rows = imports ?? [];
  const draftRows = rows.filter(
    (r) => r.status === "pending" || r.status === "failed",
  );
  const historyRows = rows.filter(
    (r) => r.status === "imported" || r.status === "skipped",
  );

  const drafts: GmailDraftView[] = draftRows.map((r) => ({
    id: r.id,
    subject: r.subject,
    sender: r.sender,
    receivedAt: r.received_at,
    status: r.status === "failed" ? "failed" : "needs_review",
    failureReason: r.failure_reason,
    preview: readGmailPreview(r.parsed_preview),
  }));

  const history: GmailHistoryView[] = historyRows.map((r) => ({
    id: r.id,
    subject: r.subject,
    sender: r.sender,
    processedAt: r.processed_at,
    status: r.status === "imported" ? "imported" : "ignored",
  }));

  // Resolve the opened draft (?review=<id>): re-fetch + re-parse that one
  // message (design §4.4 step 2, §6.4). Only applies to a needs_review row the
  // user owns. Account/category lists are loaded only when a review is active.
  let review: GmailReviewState | null = null;
  let accounts: Awaited<ReturnType<typeof fetchActiveAccounts>> = [];
  let incomeCategories: Awaited<ReturnType<typeof fetchUsableCategories>> = [];
  let expenseCategories: Awaited<ReturnType<typeof fetchUsableCategories>> = [];

  if (reviewId) {
    const target = draftRows.find(
      (r) => r.id === reviewId && r.status === "pending",
    );
    if (target) {
      // Load the current connection id for the authorized Gmail client.
      const { data: connRow } = await supabase
        .from("email_connections")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (connRow) {
        const outcome = await reparseDraftMessage(
          supabase,
          user.id,
          connRow.id,
          target.gmail_message_id,
        );

        if (outcome.kind === "ok") {
          [accounts, incomeCategories, expenseCategories] = await Promise.all([
            fetchActiveAccounts(supabase, user.id),
            fetchUsableCategories(supabase, user.id, "income"),
            fetchUsableCategories(supabase, user.id, "expense"),
          ]);
          review = {
            kind: "ok",
            importId: target.id,
            candidate: {
              amount: outcome.candidate.amount,
              direction: outcome.candidate.direction,
              transactionAt: outcome.candidate.transactionAt,
              merchant: outcome.candidate.merchant,
              description: outcome.candidate.description,
              confidence: outcome.candidate.confidence,
            },
            receivedDate: toGmailDateInputValue(target.received_at),
          };
        } else if (outcome.kind === "transient") {
          // Keep the row needs_review; show an honest retry message. No value
          // is fabricated and the row is not auto-failed.
          review = { kind: "transient", importId: target.id };
        } else {
          // Permanent 404: mark the row failed so the user can dismiss it or
          // add the transaction manually.
          await supabase
            .from("email_imports")
            .update({
              status: "failed",
              failure_reason: "Email tidak ditemukan lagi di Gmail.",
            })
            .eq("id", target.id)
            .eq("user_id", user.id);
          // Reflect the new status in the current render.
          const movedIndex = drafts.findIndex((d) => d.id === target.id);
          if (movedIndex !== -1) {
            drafts[movedIndex] = {
              ...drafts[movedIndex],
              status: "failed",
              failureReason: "Email tidak ditemukan lagi di Gmail.",
            };
          }
          review = { kind: "gone", importId: target.id };
        }
      }
    }
  }

  const hasDrafts = drafts.length > 0;
  const hasHistory = history.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <CallbackNotice error={callbackError} connected={justConnected} />

      <GmailConnectionPanel
        emailAddress={connection!.email_address}
        lastSyncedAt={connection!.last_synced_at}
      />

      {/* Honest, static context for what a sync looks at. The supported list
          matches the real senders in lib/gmail/config.ts (BCA, Shopee/
          ShopeePay, GoPay); the read-only note reflects the real
          gmail.readonly scope plus token encryption. */}
      <div className="flex flex-col gap-2">
        <p className="rounded-xl border border-border bg-surface-container px-4 py-3 text-body-sm text-on-surface-variant">
          Didukung: BCA, ShopeePay, GoPay
        </p>
        <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-container px-4 py-3 text-body-sm text-on-surface-variant">
          <Icon
            name="lock"
            size={18}
            className="mt-0.5 shrink-0 text-on-surface-variant"
          />
          <span>Akses hanya-baca, token kamu dienkripsi.</span>
        </p>
      </div>

      {hasDrafts ? (
        <GmailDraftList
          drafts={drafts}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          review={review}
        />
      ) : (
        <EmptyPanel
          glyph="inbox"
          title="Tidak ada draft untuk ditinjau"
          description="Belum ada email transaksi yang terdeteksi dari BCA, ShopeePay, atau GoPay. Coba Sync sekarang."
        />
      )}

      {hasHistory ? <GmailImportHistory entries={history} /> : null}
    </div>
  );
}

// Callback banners: an honest error (sanitized) or a success note after connect.
function CallbackNotice({
  error,
  connected,
}: {
  error: string;
  connected: boolean;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
      >
        {error}
      </p>
    );
  }
  if (connected) {
    return (
      <p
        role="status"
        className="rounded-lg border border-border bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant"
      >
        Gmail terhubung. Pilih Sync sekarang untuk mendeteksi transaksi terbaru.
      </p>
    );
  }
  return null;
}

// Honest empty state with a Material Symbol glyph, mirroring the dashboard
// EmptyPanel shape. No action link here: the only next step (Sync) lives in the
// connection panel above, so the copy points the user back to it.
function EmptyPanel({
  glyph,
  title,
  description,
}: {
  glyph: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-container-lowest p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={glyph} size={26} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-title-md text-on-surface">{title}</p>
        <p className="text-body-sm text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}

function GmailError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/settings/gmail">Muat ulang</Link>
      </Button>
    </div>
  );
}
