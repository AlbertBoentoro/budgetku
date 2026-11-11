"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createTransaction } from "@/app/(app)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TransactionTypeSwitcher } from "@/components/transactions/transaction-type-switcher";
import { TransactionSelect } from "@/components/transactions/transaction-select";
import { FREQUENCIES } from "@/lib/recurring";
import {
  clearEntryDraft,
  defaultEntryDraft,
  readEntryDraft,
  saveEntryDraft,
  shiftEntryDate,
  todayEntryDate,
  type TransactionEntryDraft,
} from "@/lib/transaction-entry-draft";
import {
  formatTransactionAmountInput,
  parseTransactionAmountInput,
} from "@/lib/transaction-amount-input";
import { isValidTransactionIdrAmount, normalizeIdrDecimalKey } from "@/lib/idr-money";
import type { AccountRow, CategoryRow, TransactionType } from "@/lib/transactions";

interface NewTransactionComposerProps {
  accounts: AccountRow[];
  expenseCategories: CategoryRow[];
  incomeCategories: CategoryRow[];
  currentMonth: string;
  restore?: "category" | "duplicate" | "back" | null;
}

const formattedDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

function dateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return iso === todayEntryDate() ? "Hari ini" : formattedDate.format(d);
}

/**
 * Mobile-first manual entry inspired by the reference interaction, not its
 * branding. Uses existing server transaction action/guard, never writes
 * balances or duplicates records on selection.
 */
export function NewTransactionComposer({
  accounts, expenseCategories, incomeCategories, currentMonth, restore = null,
}: NewTransactionComposerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<TransactionEntryDraft>(() =>
    defaultEntryDraft(accounts[0]?.id ?? ""),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const intent = useRef<"again" | "done">("done");
  const recurringRequestId = useRef<string | null>(null);
  const restored = useRef(false);
  const amountId = useId();
  const typeId = useId();
  const dateId = useId();
  const merchantId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!restore || restored.current) return;
    restored.current = true;
    const saved = readEntryDraft();
    clearEntryDraft();
    if (!saved) return;
    // Only restore active user accounts; category ownership/type is rechecked
    // by the existing Supabase action before any ledger insert.
    const active = new Set(accounts.map(a => a.id));
    setDraft({
      ...saved,
      accountId: active.has(saved.accountId) ? saved.accountId : "",
      destinationAccountId: active.has(saved.destinationAccountId) &&
        saved.destinationAccountId !== saved.accountId
          ? saved.destinationAccountId : "",
    });
  }, [restore, accounts]);

  const isTransfer = draft.transactionType === "transfer";
  const categories = draft.transactionType === "income" ? incomeCategories : expenseCategories;
  const categoryName = categories.find(c => c.id === draft.categoryId)?.name
    ?? draft.categoryName ?? "";
  const accountOptions = accounts.filter(account => account.id !== draft.accountId);
  const summaryTone = draft.transactionType === "income" ? "text-income"
    : draft.transactionType === "expense" ? "text-expense" : "text-primary";

  function update(changes: Partial<TransactionEntryDraft>) {
    setDraft(current => ({ ...current, ...changes }));
    setErrors({});
    setError(null);
    setSuccess(null);
  }

  function changeType(type: string) {
    if (type !== "expense" && type !== "income" && type !== "transfer") return;
    update({
      transactionType: type as TransactionType,
      categoryId: type === draft.transactionType ? draft.categoryId : "",
      categoryName: type === draft.transactionType ? draft.categoryName : "",
      destinationAccountId: type === "transfer" ? draft.destinationAccountId : "",
    });
  }

  function navigateTo(path: string) {
    if (isPending) return;
    saveEntryDraft(draft);
    router.push(path);
  }

  function changeAmount(raw: string) {
    const normalized = normalizeIdrDecimalKey(raw, draft.amountInput);
    if (!/^[0-9.,]*$/.test(normalized) ||
      (normalized.match(/,/g) ?? []).length > 1 ||
      (normalized.includes(",") && normalized.split(",")[1].replace(/\D/g, "").length > 2)) return;
    update({ amountInput: formatTransactionAmountInput(normalized, draft.amountInput) });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setErrors({});
    setError(null);
    setSuccess(null);

    const amount = parseTransactionAmountInput(draft.amountInput);
    const fieldErrors: Record<string, string> = {};
    if (!isValidTransactionIdrAmount(amount)) {
      fieldErrors.amount = "Nominal harus lebih dari Rp0, maksimal Rp1 triliun dan 2 desimal.";
    }
    if (!draft.accountId || !accounts.some(a => a.id === draft.accountId)) {
      fieldErrors.account_id = "Pilih rekening yang aktif.";
    }
    if (isTransfer) {
      if (!draft.destinationAccountId || draft.destinationAccountId === draft.accountId ||
          !accounts.some(a => a.id === draft.destinationAccountId)) {
        fieldErrors.destination_account_id = "Pilih rekening tujuan yang berbeda.";
      }
    } else if (!draft.categoryId) {
      fieldErrors.category_id = "Pilih kategori terlebih dahulu.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.transactionAt)) {
      fieldErrors.transaction_at = "Pilih tanggal yang valid.";
    }
    if (draft.recurring && !draft.indefinite &&
        (!draft.endDate || draft.endDate < draft.transactionAt)) {
      fieldErrors.end_date = "Tanggal berakhir harus pada atau setelah transaksi.";
    }
    if (Object.keys(fieldErrors).length || amount === null) {
      setErrors(fieldErrors);
      setError("Periksa kembali isian yang ditandai.");
      return;
    }

    const submissionIntent = intent.current;
    startTransition(async () => {
      try {
        const result = await createTransaction({
          transaction_type: draft.transactionType,
          amount,
          account_id: draft.accountId,
          destination_account_id: isTransfer ? draft.destinationAccountId : null,
          category_id: isTransfer ? null : draft.categoryId,
          transaction_at: draft.transactionAt,
          merchant: draft.merchant.trim() || null,
          description: draft.description.trim() || null,
          recurring: draft.recurring,
          frequency: draft.recurring ? draft.frequency : null,
          interval_count: draft.recurring ? 1 : null,
          recurring_indefinite: draft.indefinite,
          end_date: draft.recurring && !draft.indefinite ? draft.endDate : null,
          idempotency_key: draft.recurring
            ? (recurringRequestId.current ??= crypto.randomUUID()) : undefined,
        });
        if (!result.ok) {
          setError(result.message);
          if (result.fieldErrors) setErrors(result.fieldErrors);
          return;
        }
        // The only insert is the awaited server action above. "Tambah lagi"
        // keeps the page open but clears every previous value and idempotency.
        clearEntryDraft();
        recurringRequestId.current = null;
        setDraft(defaultEntryDraft(accounts[0]?.id ?? ""));
        if (submissionIntent === "again") {
          setSuccess("Transaksi tersimpan. Silakan catat transaksi berikutnya.");
          router.refresh();
        } else {
          const savedMonth = draft.transactionAt.slice(0, 7);
          router.push(savedMonth === currentMonth
            ? "/transactions" : `/transactions?month=${savedMonth}`);
          router.refresh();
        }
      } catch {
        setError("Gagal menghubungi server. Periksa transaksi sebelum mencoba lagi.");
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 w-full flex-col gap-5 pb-4">
      <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
        <span id={typeId} className="text-label-md font-semibold text-on-surface-variant">
          CATAT MANUAL
        </span>
        <TransactionTypeSwitcher
          value={draft.transactionType}
          onChange={changeType}
          labelId={typeId}
        />

        <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-container-low px-2 py-2">
          <button
            type="button" aria-label="Tanggal sebelumnya"
            onClick={() => update({ transactionAt: shiftEntryDate(draft.transactionAt, -1) })}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant"
          >
            <Icon name="chevron_left" size={22} />
          </button>
          <label htmlFor={dateId} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-on-surface">
            <span className="text-body-md font-semibold">{dateLabel(draft.transactionAt)}</span>
            <input
              id={dateId} type="date" value={draft.transactionAt}
              onChange={e => update({ transactionAt: e.target.value })}
              className="h-8 w-full min-w-0 max-w-full bg-transparent text-center text-body-sm text-on-surface-variant [color-scheme:dark]"
            />
          </label>
          <button
            type="button" aria-label="Tanggal berikutnya"
            onClick={() => update({ transactionAt: shiftEntryDate(draft.transactionAt, 1) })}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant"
          >
            <Icon name="chevron_right" size={22} />
          </button>
        </div>

        <div className="space-y-3 py-5 text-center">
          <Label htmlFor={amountId} className="block text-label-md text-on-surface-variant">
            Nominal {draft.transactionType === "income" ? "pemasukan" :
              isTransfer ? "transfer" : "pengeluaran"}
          </Label>
          <div className="flex min-w-0 items-baseline justify-center gap-3">
            <span className="shrink-0 text-xl font-semibold text-on-surface-variant">Rp</span>
            <Input
              id={amountId}
              value={draft.amountInput}
              onChange={e => changeAmount(e.target.value)}
              onFocus={e => { if (draft.amountInput === "0") e.currentTarget.select(); }}
              type="text" inputMode="decimal" pattern="[0-9.,]*" enterKeyHint="done"
              autoComplete="off" placeholder="0"
              aria-invalid={!!errors.amount}
              className={`h-auto min-w-0 max-w-[80%] flex-1 border-0 bg-transparent p-0 text-center text-[clamp(2.5rem,10vw,4rem)] font-bold leading-tight tabular-nums shadow-none focus-visible:ring-0 ${summaryTone}`}
            />
          </div>
          {errors.amount ? <p role="alert" className="text-body-sm text-expense">{errors.amount}</p> : null}
          <div className="flex flex-wrap justify-center gap-2">
            {[20000,50000,100000].map(delta => (
              <button
                key={delta} type="button"
                onClick={() => {
                  const next = (parseTransactionAmountInput(draft.amountInput) ?? 0) + delta;
                  if (isValidTransactionIdrAmount(next)) {
                    update({ amountInput: formatTransactionAmountInput(String(next).replace(".", ",")) });
                  }
                }}
                className="min-h-10 rounded-full bg-surface-container px-3 text-body-sm text-on-surface"
              >+{delta / 1000}rb</button>
            ))}
            <button type="button" onClick={() => update({ amountInput: "0" })}
              className="min-h-10 px-3 text-body-sm text-on-surface-variant">Reset</button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigateTo("/transactions/new/duplicate")}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container px-3 text-left text-body-sm font-medium text-on-surface"
        >
          <span className="flex items-center gap-2">
            <Icon name="content_copy" size={20} /> Duplikat transaksi sebelumnya
          </span>
          <Icon name="chevron_right" size={20} />
        </button>
      </section>

      <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="space-y-2">
          <p className="text-body-sm font-semibold text-on-surface">Rekening sumber</p>
          <div
            role="group" aria-label="Pilih rekening sumber"
            className="flex min-w-0 gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
          >
            {accounts.map(account => {
              const selected = draft.accountId === account.id;
              return (
                <button key={account.id} type="button" aria-pressed={selected}
                  onClick={() => update({
                    accountId: account.id,
                    destinationAccountId: account.id === draft.destinationAccountId ? "" : draft.destinationAccountId,
                  })}
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-body-sm font-medium transition-colors ${selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-outline-variant bg-surface-container text-on-surface"}`}>
                  {account.name}
                </button>
              );
            })}
          </div>
          {errors.account_id ? <p role="alert" className="text-body-sm text-expense">{errors.account_id}</p> : null}
        </div>

        {isTransfer ? (
          <div className="space-y-2">
            <Label htmlFor="new-entry-target">Rekening tujuan</Label>
            <TransactionSelect
              id="new-entry-target" value={draft.destinationAccountId}
              onChange={e => update({ destinationAccountId: e.target.value })}
            >
              <option value="">Pilih rekening tujuan</option>
              {accountOptions.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </TransactionSelect>
            {errors.destination_account_id ? <p role="alert" className="text-body-sm text-expense">{errors.destination_account_id}</p> : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-body-sm font-semibold text-on-surface">Kategori</p>
            <button
              type="button"
              onClick={() => navigateTo(`/transactions/new/categories?type=${draft.transactionType}`)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-outline-variant px-4 text-left text-body-md text-on-surface"
              aria-label="Buka halaman pilih kategori"
            >
              <span className={categoryName ? "font-medium" : "text-on-surface-variant"}>
                {categoryName || "Pilih kategori"}
              </span>
              <Icon name="chevron_right" size={22} />
            </button>
            {errors.category_id ? <p role="alert" className="text-body-sm text-expense">{errors.category_id}</p> : null}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={merchantId}>Toko / Pihak terkait</Label>
          <Input
            id={merchantId} value={draft.merchant} maxLength={255}
            onChange={e => update({ merchant: e.target.value })}
            className="h-12 min-w-0" placeholder="Contoh: Kopi Kenangan"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={descriptionId}>Catatan</Label>
          <Input
            id={descriptionId} value={draft.description}
            onChange={e => update({ description: e.target.value })}
            className="h-12 min-w-0" placeholder="Contoh: Kopi untuk sarapan"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
        <label className="flex min-h-11 items-center justify-between gap-3 text-body-md font-medium text-on-surface">
          <span className="flex items-center gap-2">
            <Icon name="repeat" size={20} />
            Jadikan transaksi berulang
          </span>
          <input
            type="checkbox" checked={draft.recurring}
            onChange={e => update({ recurring: e.target.checked })}
            className="size-5 accent-primary"
          />
        </label>
        {draft.recurring ? (
          <div className="space-y-3 border-t border-outline-variant pt-3">
            <Label htmlFor="new-entry-frequency">Frekuensi</Label>
            <TransactionSelect
              id="new-entry-frequency" value={draft.frequency}
              onChange={e => update({ frequency: e.target.value })}
            >
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </TransactionSelect>
            <label className="flex min-h-11 items-center gap-3 text-body-sm text-on-surface">
              <input type="checkbox" checked={draft.indefinite}
                onChange={e => update({ indefinite: e.target.checked })}
                className="size-5 accent-primary" />
              Sampai waktu yang tidak ditentukan
            </label>
            {!draft.indefinite ? (
              <div className="space-y-2">
                <Label htmlFor="new-entry-end">Berakhir pada</Label>
                <Input id="new-entry-end" type="date" min={draft.transactionAt}
                  value={draft.endDate} onChange={e => update({ endDate: e.target.value })}
                  className="h-11 w-full min-w-0 max-w-full" />
                {errors.end_date ? <p role="alert" className="text-body-sm text-expense">{errors.end_date}</p> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-body-sm text-on-surface-variant">
            Opsional. Jadwal berikutnya dikelola dari Transaksi berulang.
          </p>
        )}
      </section>

      {error ? <p role="alert" className="rounded-lg border border-expense/30 bg-expense/5 p-3 text-body-sm text-expense">{error}</p> : null}
      {success ? <p role="status" className="rounded-lg border border-income/30 p-3 text-body-sm text-income">{success}</p> : null}

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex min-w-0 gap-3 rounded-xl bg-surface/95 p-3 shadow-lg backdrop-blur">
        <Button
          type="submit" variant="outline" className="h-12 min-w-0 flex-1"
          disabled={isPending}
          onClick={() => { intent.current = "again"; }}
        >
          Tambah lagi
        </Button>
        <Button
          type="submit" className="h-12 min-w-0 flex-1"
          disabled={isPending}
          onClick={() => { intent.current = "done"; }}
        >
          {isPending ? "Menyimpan…" : "Selesai"}
        </Button>
      </div>
    </form>
  );
}
