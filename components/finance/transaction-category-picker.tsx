"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createUserCategory } from "@/app/(app)/transactions/category-actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { readEntryDraft, saveEntryDraft } from "@/lib/transaction-entry-draft";
import type { CategoryRow } from "@/lib/transactions";

interface CategoryPickerProps {
  direction: "income" | "expense";
  categories: CategoryRow[];
}

/** Dedicated full-page category selector, not a native dropdown or a
 * fake modal. The form's already-typed fields are kept in sessionStorage. */
export function CategoryPicker({ direction, categories }: CategoryPickerProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matching = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("id-ID");
    return categories.filter(c =>
      c.category_type === direction &&
      (!q || c.name.toLocaleLowerCase("id-ID").includes(q))
    );
  }, [categories, direction, search]);
  const custom = matching.filter(c => c.user_id !== null);
  const shared = matching.filter(c => c.user_id === null);

  function choose(category: { id: string; name: string }) {
    const snapshot = readEntryDraft();
    if (!snapshot) {
      setError("Isian transaksi sebelumnya tidak ditemukan. Kembali ke Catat dan coba lagi.");
      return;
    }
    if (snapshot.transactionType !== direction) {
      setError("Jenis transaksi berubah. Kembali ke Catat dan pilih lagi.");
      return;
    }
    saveEntryDraft({ ...snapshot, categoryId: category.id, categoryName: category.name });
    router.push("/transactions/new?restore=category");
  }

  function createCategory() {
    const name = newName.trim();
    if (pending || !name) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createUserCategory({ name, category_type: direction });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        choose(result.category);
      } catch {
        setError("Kategori belum berhasil dibuat. Coba lagi.");
      }
    });
  }

  function list(items: CategoryRow[], heading: string) {
    if (!items.length) return null;
    return (
      <section aria-label={heading} className="space-y-2">
        <h2 className="px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
          {heading}
        </h2>
        <ul className="divide-y divide-outline-variant rounded-xl bg-surface-container-lowest">
          {items.map(category => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => choose(category)}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-body-md text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 break-words">{category.name}</span>
                <Icon name="chevron_right" size={20} className="shrink-0 text-on-surface-variant" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pb-8">
      <div className="relative">
        <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari kategori" aria-label="Cari kategori"
          className="h-12 min-w-0 rounded-xl bg-surface-container-lowest pl-11"
        />
      </div>

      <Button
        type="button" variant="outline"
        onClick={() => { setAdding(v => !v); setError(null); }}
        className="flex h-12 w-full justify-between rounded-xl border-primary/50 bg-primary/10 px-4 text-primary"
      >
        <span>+ Buat kategori baru</span>
        <Icon name="add" size={20} />
      </Button>

      {adding ? (
        <form
          onSubmit={e => { e.preventDefault(); createCategory(); }}
          className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
        >
          <label htmlFor="entry-category-name" className="text-body-sm font-semibold text-on-surface">
            Nama kategori {direction === "income" ? "pemasukan" : "pengeluaran"}
          </label>
          <Input
            id="entry-category-name" autoFocus maxLength={60} value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={direction === "income" ? "Contoh: Freelance" : "Contoh: Laundry"}
            className="h-11"
          />
          <div className="flex gap-3">
            <Button type="submit" className="h-11 flex-1" disabled={pending || !newName.trim()}>
              {pending ? "Menyimpan…" : "Simpan dan pilih"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => setAdding(false)}>
              Batal
            </Button>
          </div>
        </form>
      ) : null}

      {error ? <p role="alert" className="rounded-lg border border-expense/30 p-3 text-body-sm text-expense">{error}</p> : null}

      {list(custom, "Kategori saya")}
      {list(shared, "Kategori tersedia")}
      {!matching.length ? (
        <p className="py-8 text-center text-body-sm text-on-surface-variant">
          Kategori tidak ditemukan. Buat kategori baru untuk melanjutkan.
        </p>
      ) : null}
    </div>
  );
}
