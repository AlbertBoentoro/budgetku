import { Suspense } from "react";
import { connection } from "next/server";

import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { GmailPendingQueue, type PendingGmailTransaction } from "@/components/transactions/gmail-pending-queue";
import { readGmailPreview } from "@/lib/gmail/preview";
import { createClient } from "@/lib/supabase/server";

export default function AllPendingGmailPage() {
  return (
    <>
      <AppHeader
        title="Persetujuan Gmail"
        titleAction={<AppBackLink href="/transactions" label="Kembali ke Transaksi" />}
      />
      <PageContainer className="pb-8">
        <Suspense fallback={<p className="text-body-sm text-on-surface-variant">Memuat draft Gmail…</p>}>
          <AllPendingGmailContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function AllPendingGmailContent() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p role="alert">Sesi berakhir. Silakan login kembali.</p>;

  const { data, error, count } = await supabase
    .from("email_imports")
    .select("id, subject, received_at, parsed_preview", { count: "exact" })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) return <p role="alert">Draft Gmail tidak bisa dimuat. Coba lagi.</p>;
  if (!count) return (
    <p className="text-body-sm text-on-surface-variant">
      Tidak ada transaksi Gmail yang menunggu persetujuan.
    </p>
  );

  const drafts: PendingGmailTransaction[] = (data ?? []).map(row => ({
    id: row.id,
    subject: row.subject,
    receivedAt: row.received_at,
    preview: readGmailPreview(row.parsed_preview),
  }));

  return (
    <div className="flex flex-col gap-3">
      {count > 50 ? (
        <p className="text-body-sm text-on-surface-variant">
          Menampilkan 50 draft terbaru dari {count} draft. Setelah diproses, muat ulang untuk melihat sisanya.
        </p>
      ) : null}
      <GmailPendingQueue drafts={drafts} total={count} showAllLink={false} />
    </div>
  );
}
