import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Repeat } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveAccounts,
  fetchRecurringTemplates,
  fetchUsableCategories,
  type CategoryRow,
} from "@/lib/recurring";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { RecurringList } from "@/components/finance/recurring-list";
import type { RecurringRowView } from "@/components/finance/recurring-list-row";
import { Button } from "@/components/ui/button";
import { RecurringLoading } from "@/app/(app)/recurring/loading";

export default function RecurringPage() {
  return (
    <>
      <AppHeader
        title="Transaksi berulang"
        action={
          // Recurring is managed from Settings (not the bottom nav), so offer a
          // clear way back to Pengaturan, its entry point.
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href="/settings">
              <ArrowLeft aria-hidden />
              Pengaturan
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <Suspense fallback={<RecurringLoading />}>
          <RecurringContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function RecurringContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the query strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <RecurringError message="Sesi berakhir. Silakan masuk kembali untuk melihat transaksi berulang." />
    );
  }

  let templates;
  try {
    templates = await fetchRecurringTemplates(supabase, user.id);
  } catch {
    return (
      <RecurringError message="Transaksi berulang gagal dimuat. Periksa koneksi lalu coba lagi." />
    );
  }

  // No templates at all: a first-run empty state inviting the first entry.
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState
          icon={Repeat}
          title="Belum ada transaksi berulang"
          description="Buat jadwal untuk pemasukan, pengeluaran, atau transfer yang terjadi berulang."
        />
        <Button asChild className="h-11">
          <Link href="/transactions/new">
            <Plus aria-hidden />
            Tambah lewat Tambah transaksi
          </Link>
        </Button>
      </div>
    );
  }

  // Resolve account and category names. Active accounts/usable categories cover
  // most rows; a single follow-up lookup fills archived references so a row
  // never shows a blank account/category (no N+1).
  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    fetchActiveAccounts(supabase, user.id),
    fetchUsableCategories(supabase, user.id, "income"),
    fetchUsableCategories(supabase, user.id, "expense"),
  ]);

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const missingAccountIds = new Set<string>();
  for (const t of templates) {
    if (t.account_id && !accountNameById.has(t.account_id)) {
      missingAccountIds.add(t.account_id);
    }
    if (
      t.destination_account_id &&
      !accountNameById.has(t.destination_account_id)
    ) {
      missingAccountIds.add(t.destination_account_id);
    }
  }
  if (missingAccountIds.size > 0) {
    const { data: extraAccounts } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", user.id)
      .in("id", Array.from(missingAccountIds));
    for (const a of extraAccounts ?? []) {
      accountNameById.set(a.id, a.name);
    }
  }

  const categoryNameById = new Map<string, string>();
  for (const c of [...incomeCategories, ...expenseCategories]) {
    categoryNameById.set(c.id, c.name);
  }
  const missingCategoryIds = new Set<string>();
  for (const t of templates) {
    if (t.category_id && !categoryNameById.has(t.category_id)) {
      missingCategoryIds.add(t.category_id);
    }
  }
  if (missingCategoryIds.size > 0) {
    const { data: extraCategories } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", Array.from(missingCategoryIds));
    for (const c of (extraCategories ?? []) as Pick<
      CategoryRow,
      "id" | "name"
    >[]) {
      categoryNameById.set(c.id, c.name);
    }
  }

  const rows: RecurringRowView[] = templates.map((t) => ({
    ...t,
    accountName: t.account_id ? accountNameById.get(t.account_id) ?? null : null,
    destinationAccountName: t.destination_account_id
      ? accountNameById.get(t.destination_account_id) ?? null
      : null,
    categoryName: t.category_id
      ? categoryNameById.get(t.category_id) ?? null
      : null,
  }));

  const active = rows.filter((r) => r.is_active);
  const paused = rows.filter((r) => !r.is_active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Semua jadwal
        </h2>
        <Button asChild size="sm" className="h-9">
          <Link href="/transactions/new">
            <Plus aria-hidden />
            Tambah transaksi
          </Link>
        </Button>
      </div>

      <RecurringList active={active} paused={paused} />
    </div>
  );
}

function RecurringError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/recurring">Muat ulang</Link>
      </Button>
    </div>
  );
}
