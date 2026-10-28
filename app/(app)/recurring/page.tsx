import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveAccounts,
  fetchRecurringTemplates,
  fetchUsableCategories,
  type CategoryRow,
  type RecurringRow,
} from "@/lib/recurring";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { RecurringList } from "@/components/finance/recurring-list";
import type { RecurringRowView } from "@/components/finance/recurring-list-row";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RecurringLoading } from "@/app/(app)/recurring/loading";

export default function RecurringPage() {
  return (
    <>
      <AppHeader
        title="Transaksi Berulang"
        titleAction={
          <AppBackLink href="/settings" label="Kembali ke Pengaturan" />
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

// Normalize one template's amount to a monthly figure so schedules of mixed
// cadence are not summed as if they were all monthly. Pure, derived only from
// real stored fields (frequency, interval_count, amount). Unknown frequency is
// treated as monthly (the same fallback the frequency helpers use).
function monthlyEquivalent(template: RecurringRow): number {
  const interval =
    Number.isFinite(template.interval_count) && template.interval_count >= 1
      ? Math.floor(template.interval_count)
      : 1;
  const amount = template.amount;
  switch (template.frequency) {
    case "daily":
      return (amount * 30) / interval;
    case "weekly":
      return (amount * 52) / 12 / interval;
    case "yearly":
      return amount / 12 / interval;
    case "monthly":
    default:
      return amount / interval;
  }
}

async function RecurringContent() {
  // Request-time work: creating the Supabase client reads the clock (session
  // expiry), which partialPrefetching rejects before connection().
  await connection();

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

  // No templates at all: a first-run empty state inviting the first entry via
  // the add-transaction form (where the "berulang" checkbox lives).
  if (templates.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-container-lowest p-lg text-center">
          <span
            className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
            aria-hidden
          >
            <Icon name="event_repeat" size={24} />
          </span>
          <p className="text-title-md text-on-surface">
            Belum ada transaksi berulang
          </p>
          <p className="max-w-xs text-body-sm text-on-surface-variant">
            Mulai dari formulir transaksi, lalu aktifkan pilihan berulang.
            Jadwalnya akan muncul di sini.
          </p>
          <Button asChild className="mt-2 h-11">
            <Link href="/transactions/new">
              <Icon name="add" size={20} />
              Tambah transaksi
            </Link>
          </Button>
        </div>
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

  // Real figure: the normalized monthly total of ACTIVE expense templates. Only
  // expense rows feed this (income/transfer are excluded), so the label is
  // honest. Rounded to a whole IDR number for display.
  const monthlyExpenseTotal = Math.round(
    active
      .filter((r) => r.transaction_type === "expense")
      .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
  );

  return (
    <div className="flex flex-col gap-6">
      <IntroRow />

      <section className="flex flex-col gap-1 rounded-xl border border-border bg-surface-container-lowest p-lg">
        <span className="text-label-xs uppercase text-on-surface-variant">
          Total Beban Rutin Bulanan
        </span>
        <AmountText
          value={monthlyExpenseTotal}
          size="none"
          tone="expense"
          className="text-currency-display text-on-surface"
        />
        <span className="text-body-sm text-on-surface-variant">
          Estimasi dari pengeluaran rutin aktif
        </span>
        <span className="text-body-sm text-on-surface-variant">
          {active.length} jadwal aktif
        </span>
      </section>

      <RecurringList active={active} paused={paused} />
    </div>
  );
}

// Section heading + the create entry point. Creation happens via the
// add-transaction form (the "berulang" checkbox), so "Tambah Jadwal" routes
// there; the wording stays honest about where a schedule is created.
function IntroRow() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl text-body-sm text-on-surface-variant">
        Kelola jadwal transaksi dan catat kembali saat waktunya tiba.
      </p>
      <Button asChild size="sm" className="h-11 self-start sm:shrink-0">
        <Link href="/transactions/new">
          <Icon name="add" size={18} />
          Tambah transaksi
        </Link>
      </Button>
    </div>
  );
}

function RecurringError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/recurring">Muat ulang</Link>
      </Button>
    </div>
  );
}
