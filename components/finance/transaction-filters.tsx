"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { TRANSACTION_TYPES, type AccountRow } from "@/lib/transactions";
import type { CategoryRow } from "@/lib/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Same native-select styling the account form uses, kept in one place so the
// filter selects match the rest of the app exactly.
const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const FILTER_KEYS = ["q", "type", "account", "category", "month"] as const;

interface TransactionFiltersProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
}

export function TransactionFilters({
  accounts,
  categories,
}: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchId = useId();
  const typeId = useId();
  const accountId = useId();
  const categoryId = useId();
  const monthId = useId();

  // Read the live URL values so the controls reflect a shared/bookmarked URL.
  const currentQ = searchParams.get("q") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentAccount = searchParams.get("account") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentMonth = searchParams.get("month") ?? "";

  const hasActiveFilter = FILTER_KEYS.some((key) =>
    Boolean(searchParams.get(key)),
  );

  // Local search text so typing stays responsive; the URL updates on a debounce
  // so each keystroke does not trigger a navigation.
  const [searchText, setSearchText] = useState(currentQ);

  // Keep the local field in sync when the URL changes from elsewhere (e.g. the
  // reset action or a back/forward navigation).
  useEffect(() => {
    setSearchText(currentQ);
  }, [currentQ]);

  // Build a URL with one key set or cleared, preserving the other filters.
  const buildHref = useMemo(
    () =>
      (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
        const query = params.toString();
        return query ? `${pathname}?${query}` : pathname;
      },
    [pathname, searchParams],
  );

  function updateParam(key: string, value: string) {
    router.replace(buildHref(key, value), { scroll: false });
  }

  // Debounce the search term so the ledger does not re-query on every keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearchText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam("q", value.trim());
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function resetFilters() {
    router.replace(pathname, { scroll: false });
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Saring">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Saring</h2>
        {hasActiveFilter ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={resetFilters}
          >
            <X aria-hidden />
            Hapus filter
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={searchId}>Cari transaksi</Label>
        <Input
          id={searchId}
          type="search"
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-11"
          placeholder="Cari deskripsi atau merchant"
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 min-[375px]:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={typeId}>Jenis</Label>
          <select
            id={typeId}
            value={currentType}
            onChange={(e) => updateParam("type", e.target.value)}
            className={cn(selectClassName)}
          >
            <option value="">Semua</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={accountId}>Rekening</Label>
          <select
            id={accountId}
            value={currentAccount}
            onChange={(e) => updateParam("account", e.target.value)}
            className={cn(selectClassName)}
          >
            <option value="">Semua</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={categoryId}>Kategori</Label>
          <select
            id={categoryId}
            value={currentCategory}
            onChange={(e) => updateParam("category", e.target.value)}
            className={cn(selectClassName)}
          >
            <option value="">Semua</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={monthId}>Bulan</Label>
          <Input
            id={monthId}
            type="month"
            value={currentMonth}
            onChange={(e) => updateParam("month", e.target.value)}
            className="h-11"
          />
        </div>
      </div>
    </section>
  );
}
