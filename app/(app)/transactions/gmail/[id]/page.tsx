import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { GmailImportReview } from "@/components/finance/gmail-import-review";
import { Button } from "@/components/ui/button";
import { readGmailPreview } from "@/lib/gmail/preview";
import { toGmailDateInputValue } from "@/lib/gmail/date-format";
import { fetchActiveAccounts, fetchUsableCategories } from "@/lib/transactions";
import { createClient } from "@/lib/supabase/server";

interface GmailReviewPageProps {
  params: Promise<{ id: string }>;
}

/** Full-screen Gmail review. Reuses Catat's real form instead of nesting a
 * second cramped form inside Settings or a narrow draft row on iPhone. */
export default function GmailReviewPage({ params }: GmailReviewPageProps) {
  return (
    <>
      <AppHeader
        title="Terima dari Gmail"
        titleAction={<AppBackLink href="/transactions" label="Kembali ke Transaksi" />}
      />
      <PageContainer className="pb-8">
        <Suspense fallback={<p className="text-body-sm text-on-surface-variant">Memuat detail Gmail…</p>}>
          <GmailReviewContent params={params} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function GmailReviewContent({ params }: GmailReviewPageProps) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <ReviewError message="Sesi berakhir. Masuk lagi untuk memeriksa transaksi Gmail." />;

  // Never let the URL reveal another user's email or an already-processed draft.
  const { data: draft, error } = await supabase
    .from("email_imports")
    .select("id, subject, status, received_at, parsed_preview")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (error) return <ReviewError message="Data impor Gmail tidak bisa dimuat." />;
  if (!draft) return <ReviewError message="Draft Gmail tidak ditemukan atau sudah diproses." />;

  const preview = readGmailPreview(draft.parsed_preview);
  const candidate = {
    amount: preview?.amount ?? null,
    direction: preview?.direction ?? null,
    transactionAt: preview?.transactionAt ?? null,
    merchant: preview?.merchant ?? null,
    description: preview?.description ?? null,
    confidence: preview?.confidence ?? ("low" as const),
  };
  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    fetchActiveAccounts(supabase, user.id),
    fetchUsableCategories(supabase, user.id, "income"),
    fetchUsableCategories(supabase, user.id, "expense"),
  ]);
  if (accounts.length === 0) {
    return <ReviewError message="Tambahkan rekening dulu sebelum menerima transaksi Gmail." />;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="break-words text-body-sm text-on-surface-variant">
        Email: {draft.subject?.trim() || "Tanpa subjek"}
      </p>
      <GmailImportReview
        importId={draft.id}
        candidate={candidate}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        receivedDate={toGmailDateInputValue(draft.received_at)}
      />
    </div>
  );
}

function ReviewError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p role="alert" className="text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline">
        <Link href="/transactions">Kembali ke Transaksi</Link>
      </Button>
    </div>
  );
}
