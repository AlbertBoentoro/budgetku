"use client";

import { useMemo, useState } from "react";

import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import type { CategoryRow, TransactionType } from "@/lib/transactions";
import { cn } from "@/lib/utils";

// These are full-viewport child screens of Catat, not separate HTML forms.
// Keeping the parent TransactionForm mounted preserves unsaved amounts, notes,
// recurrence, and account selections when the user returns.
export interface DuplicateTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  transaction_at: string;
  merchant: string | null;
  description: string | null;
}

function SelectionScreen({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex min-h-0 flex-col bg-surface text-on-surface"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex min-h-16 w-full max-w-3xl shrink-0 items-center gap-3 border-b border-outline-variant bg-surface px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali ke Tambah transaksi"
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon name="arrow_back" size={24} />
        </button>
        <h2 className="min-w-0 text-title-lg font-semibold">{title}</h2>
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-5">
        {subtitle ? <p className="mb-5 text-body-sm text-on-surface-variant">{subtitle}</p> : null}
        {children}
      </div>
      {footer ? (
        <div
          className="w-full shrink-0 border-t border-outline-variant bg-surface px-4 py-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto w-full max-w-3xl">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

export function TransactionCategoryScreen({
  categories,
  selectedId,
  direction,
  onPick,
  onBack,
  createName,
  onCreateNameChange,
  onCreate,
  creating,
  createError,
}: {
  categories: Array<Pick<CategoryRow, "id" | "name"> & { user_id?: string | null }>;
  selectedId: string;
  direction: "income" | "expense";
  onPick: (id: string) => void;
  onBack: () => void;
  createName: string;
  onCreateNameChange: (name: string) => void;
  onCreate: () => void;
  creating: boolean;
  createError: string | null;
}) {
  const [search, setSearch] = useState("");
  const [showCreator, setShowCreator] = useState(false);

  const results = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return categories.filter((cat) =>
      !query || cat.name.toLocaleLowerCase("id-ID").includes(query),
    );
  }, [categories, search]);

  const personal = results.filter((cat) => cat.user_id !== null);
  const system = results.filter((cat) => cat.user_id === null);

  return (
    <SelectionScreen
      title="Pilih kategori"
      subtitle={direction === "income" ? "Kategori pemasukan" : "Kategori pengeluaran"}
      onBack={onBack}
    >
      <div className="relative mb-3">
        <Icon name="search" size={21} className="pointer-events-none absolute left-3 top-3.5 text-on-surface-variant" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari kategori"
          aria-label="Cari kategori"
          className="h-12 rounded-xl pl-11 text-base"
        />
      </div>

      <button
        type="button"
        className="mb-5 flex min-h-12 w-full items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 text-body-md font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setShowCreator((old) => !old)}
        aria-expanded={showCreator}
      >
        Buat kategori baru
        <Icon name={showCreator ? "close" : "add"} size={22} />
      </button>

      {showCreator ? (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
          <label htmlFor="category-picker-create-name" className="text-body-sm font-medium">
            Nama kategori
          </label>
          <Input
            id="category-picker-create-name"
            value={createName}
            onChange={(event) => onCreateNameChange(event.target.value)}
            maxLength={60}
            autoComplete="off"
            placeholder="Contoh: Laundry"
            disabled={creating}
            className="h-11"
          />
          {createError ? <p role="alert" className="text-body-sm text-expense">{createError}</p> : null}
          <Button
            type="button"
            className="h-11"
            onClick={onCreate}
            disabled={creating || !createName.trim()}
          >
            {creating ? "Menyimpan..." : "Simpan dan pilih kategori"}
          </Button>
        </div>
      ) : null}

      {results.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-on-surface-variant">
          Kategori tidak ditemukan. Gunakan Buat kategori baru untuk menambahkannya.
        </p>
      ) : null}
      {[
        { label: "Kategori pribadi", items: personal },
        { label: "Kategori tersedia", items: system },
      ].map((group) => group.items.length > 0 ? (
        <section key={group.label} aria-label={group.label} className="mb-5">
          <h3 className="mb-2 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
            {group.label}
          </h3>
          <div className="divide-y divide-outline-variant">
            {group.items.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onPick(category.id)}
                aria-current={selectedId === category.id ? "true" : undefined}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between gap-3 px-2 text-left text-body-md hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedId === category.id && "font-semibold text-primary",
                )}
              >
                <span className="min-w-0 break-words">{category.name}</span>
                {selectedId === category.id ? (
                  <Icon name="check_circle" size={22} className="shrink-0 text-primary" />
                ) : (
                  <Icon name="chevron_right" size={20} className="shrink-0 text-on-surface-variant" />
                )}
              </button>
            ))}
          </div>
        </section>
      ) : null)}
    </SelectionScreen>
  );
}

export function TransactionDuplicateScreen({
  transactions,
  accountNames,
  categoryNames,
  onPick,
  onBack,
}: {
  transactions: DuplicateTransaction[];
  accountNames: Record<string, string>;
  categoryNames: Record<string, string>;
  onPick: (transaction: DuplicateTransaction) => void;
  onBack: () => void;
}) {
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    if (!query) return transactions;
    return transactions.filter((txn) => {
      const label = [txn.merchant, txn.description, accountNames[txn.account_id],
        txn.category_id ? categoryNames[txn.category_id] : null].join(" ");
      return label.toLocaleLowerCase("id-ID").includes(query);
    });
  }, [transactions, search, accountNames, categoryNames]);
  const visible = all || search.trim() ? filtered : filtered.slice(0, 10);
  const typeLabel: Record<TransactionType, string> = {
    expense: "Pengeluaran",
    income: "Pemasukan",
    transfer: "Transfer",
  };

  return (
    <SelectionScreen
      title="Duplikat transaksi"
      subtitle="Pilih transaksi lama untuk menyalin isinya ke form baru. Tidak akan langsung disimpan."
      onBack={onBack}
      footer={!all && !search.trim() && filtered.length > 10 ? (
        <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setAll(true)}>
          Lihat semua {transactions.length} transaksi terbaru
        </Button>
      ) : undefined}
    >
      <div className="relative mb-5">
        <Icon name="search" size={21} className="pointer-events-none absolute left-3 top-3.5 text-on-surface-variant" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari transaksi"
          aria-label="Cari transaksi sebelumnya"
          className="h-12 rounded-xl pl-11 text-base"
        />
      </div>
      {visible.length === 0 ? (
        <p className="py-10 text-center text-body-sm text-on-surface-variant">
          {transactions.length ? "Transaksi tidak ditemukan." : "Belum ada transaksi yang bisa diduplikat."}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {visible.map((txn) => {
          const type = txn.transaction_type as TransactionType;
          const tone = type === "expense" ? "expense" : type === "income" ? "income" : "default";
          const title = txn.merchant?.trim() ||
            (txn.category_id ? categoryNames[txn.category_id] : null) ||
            typeLabel[type] || "Transaksi";
          const account = accountNames[txn.account_id] || "Rekening lama";
          const day = txn.transaction_at.slice(0, 10);
          return (
            <li key={txn.id}>
              <button
                type="button"
                className="flex min-h-20 w-full items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-3 text-left hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onPick(txn)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="break-words text-body-md font-semibold">{title}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">
                    {typeLabel[type] || "Transaksi"} · {account}
                  </span>
                  <span className="truncate text-label-md text-on-surface-variant">
                    {day}{txn.description ? ` · ${txn.description}` : ""}
                  </span>
                </span>
                <AmountText
                  value={type === "expense" ? -txn.amount : txn.amount}
                  tone={tone}
                  size="md"
                  className="shrink-0"
                />
              </button>
            </li>
          );
        })}
      </ul>
      {transactions.length >= 100 ? (
        <p className="py-4 text-center text-label-md text-on-surface-variant">
          Menampilkan 100 transaksi terbaru.
        </p>
      ) : null}
    </SelectionScreen>
  );
}
