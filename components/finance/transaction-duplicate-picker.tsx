"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { AmountText } from "@/components/finance/amount-text";
import {
  draftFromTransaction,
  saveEntryDraft,
} from "@/lib/transaction-entry-draft";
import type { AccountRow, CategoryRow, TransactionRow } from "@/lib/transactions";

export type DuplicableRow = Pick<TransactionRow,
  "id" | "transaction_type" | "amount" | "transaction_at" |
  "account_id" | "destination_account_id" | "category_id" |
  "merchant" | "description">;

interface DuplicatePickerProps {
  transactions: DuplicableRow[];
  accounts: AccountRow[];
  categories: CategoryRow[];
}

export function DuplicateTransactionPicker({
  transactions, accounts, categories,
}: DuplicatePickerProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const accountNames = new Map(accounts.map(a => [a.id, a.name]));
  const categoryNames = new Map(categories.map(c => [c.id, c.name]));

  const matching = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("id-ID");
    if (!q) return transactions;
    return transactions.filter(row => [
      row.merchant, row.description, accountNames.get(row.account_id),
      row.category_id ? categoryNames.get(row.category_id) : "",
    ].some(part => part?.toLocaleLowerCase("id-ID").includes(q)));
  }, [transactions, search]); // maps derive from same immutable server props
  const visible = showAll ? matching : matching.slice(0, 10);

  function select(row: DuplicableRow) {
    const categoryId = row.category_id;
    const safe = draftFromTransaction(
      row, accounts.map(a => a.id), categories.map(c => c.id),
    );
    safe.categoryName = categoryId ? categoryNames.get(safe.categoryId) ?? "" : "";
    saveEntryDraft(safe);
    router.push("/transactions/new?restore=duplicate");
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <div>
        <h2 className="text-title-lg font-semibold text-on-surface">
          Pilih transaksi yang mau diduplikat
        </h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Isian akan disalin, tanggal menjadi hari ini. Tidak ada transaksi baru sampai lu menekan Selesai.
        </p>
      </div>

      <div className="relative">
        <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari toko, catatan atau kategori"
          aria-label="Cari transaksi untuk diduplikat"
          className="h-12 min-w-0 rounded-xl bg-surface-container-lowest pl-11"
        />
      </div>

      <p className="text-label-md font-medium text-on-surface-variant">
        {showAll ? "Hasil transaksi" : "10 transaksi terakhir"}
      </p>
      <ul className="flex flex-col gap-2">
        {visible.map(row => {
          const isExpense = row.transaction_type === "expense";
          const isIncome = row.transaction_type === "income";
          const account = accountNames.get(row.account_id) ?? "Rekening tidak aktif";
          const destination = row.destination_account_id
            ? accountNames.get(row.destination_account_id) : null;
          const label = row.category_id
            ? categoryNames.get(row.category_id)
            : row.transaction_type === "transfer" ? "Transfer" : "";
          const name = row.merchant?.trim() || label || row.description?.trim() || "Transaksi";
          const secondary = row.transaction_type === "transfer" && destination
            ? `${account} → ${destination}` : [account, label].filter(Boolean).join(" · ");
          return (
            <li key={row.id}>
              <button type="button" onClick={() => select(row)}
                className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
                  <Icon
                    name={isIncome ? "arrow_downward" : isExpense ? "arrow_upward" : "sync_alt"}
                    size={20}
                    className={isIncome ? "text-income" : isExpense ? "text-expense" : "text-primary"}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-body-md font-semibold text-on-surface">{name}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">{secondary}</span>
                </span>
                <AmountText
                  value={isExpense ? -Number(row.amount) : Number(row.amount)}
                  tone={isExpense ? "expense" : isIncome ? "income" : "default"}
                  size="none" signed={isExpense || isIncome}
                  className="shrink-0 text-body-sm font-semibold"
                />
              </button>
            </li>
          );
        })}
      </ul>
      {!visible.length ? (
        <p className="text-center text-body-sm text-on-surface-variant">
          Belum ada transaksi yang cocok.
        </p>
      ) : null}
      {!showAll && matching.length > 10 ? (
        <button type="button" onClick={() => setShowAll(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-body-md font-semibold text-on-surface">
          Lihat semua transaksi ({matching.length})
          <Icon name="expand_more" size={20} />
        </button>
      ) : null}
      {showAll && transactions.length >= 100 ? (
        <p className="text-body-sm text-on-surface-variant">
          Menampilkan maksimal 100 transaksi terbaru.
        </p>
      ) : null}
    </div>
  );
}
