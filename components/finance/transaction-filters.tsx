"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  TRANSACTION_TYPES,
  activeMonthFrom,
  parseTransactionFilters,
  type AccountRow,
} from "@/lib/transactions";
import type { CategoryRow } from "@/lib/transactions";
import { formatMonthLabel } from "@/lib/budgets";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Same native-select styling the account form uses, kept in one place so the
// filter selects match the rest of the app exactly.
const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

// Shared chip styling (44px tap target); active vs inactive differ in fill +
// text tone, so the active chip is never conveyed by color alone (the selected
// filter is also reflected in the URL and the list below).
const chipBase =
  "inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-4 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const chipActive = "bg-primary text-primary-foreground";
const chipInactive =
  "bg-surface-container text-on-surface-variant hover:bg-surface-container-high";

const FILTER_KEYS = ["q", "type", "account", "category", "month"] as const;

interface TransactionFiltersProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  // An archived account that is the active (validated) filter. It is not in
  // the active list, so it is offered as an extra option to keep the select
  // in sync with the URL.
  extraAccount?: { id: string; name: string } | null;
}

export function TransactionFilters({
  accounts,
  categories,
  extraAccount = null,
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

  // The month the summary/ledger is scoped to: the explicit filter or the
  // current month. Labeled "Bulan Ini" only when no explicit month is set.
  const paramsRecord = Object.fromEntries(searchParams.entries());
  const parsed = parseTransactionFilters(paramsRecord);
  const activeMonth = activeMonthFrom(parsed);
  const monthChipLabel = parsed.month
    ? formatMonthLabel(parsed.month)
    : `Bulan Ini \u00b7 ${formatMonthLabel(activeMonth)}`;

  // Advanced panel (account/category/month) is hidden behind a tune toggle so
  // the chip row stays compact; it opens automatically when one of those
  // filters is already active from the URL.
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(currentAccount || currentCategory || currentMonth),
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

  function clearSearch() {
    setSearchText("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam("q", "");
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function resetFilters() {
    setSearchText("");
    router.replace(pathname, { scroll: false });
  }

  // Type chips: "Semua" clears the type; each other chip sets type=value.
  const typeChips = [
    { value: "", label: "Semua" },
    ...TRANSACTION_TYPES.map((t) => ({ value: t.value, label: t.label })),
  ];

  return (
    <section className="flex flex-col gap-3" aria-label="Saring transaksi">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <Icon name="search" size={20} />
        </span>
        <Label htmlFor={searchId} className="sr-only">
          Cari transaksi
        </Label>
        <Input
          id={searchId}
          type="search"
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-11 rounded-full border-transparent bg-surface-container-low pl-10 pr-10"
          placeholder="Cari deskripsi atau merchant"
          autoComplete="off"
        />
        {searchText ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>

      <div className="-mx-space-xs flex gap-2 overflow-x-auto px-space-xs pb-1">
        {typeChips.map((chip) => {
          const isActive = currentType === chip.value;
          return (
            <button
              key={chip.value || "all"}
              type="button"
              onClick={() => updateParam("type", chip.value)}
              aria-pressed={isActive}
              className={cn(chipBase, isActive ? chipActive : chipInactive)}
            >
              {chip.label}
            </button>
          );
        })}

        <span className={cn(chipBase, chipInactive, "cursor-default")}>
          <Icon name="calendar_month" size={16} />
          {monthChipLabel}
        </span>

        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          aria-expanded={advancedOpen}
          aria-controls={`${typeId}-panel`}
          className={cn(chipBase, advancedOpen ? chipActive : chipInactive)}
        >
          <Icon name="tune" size={16} />
          Filter
        </button>
      </div>

      {advancedOpen ? (
        <div
          id={`${typeId}-panel`}
          className="grid grid-cols-1 gap-3 rounded-xl bg-surface-container-low p-space-md min-[375px]:grid-cols-2"
        >
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
              {extraAccount &&
              !accounts.some((a) => a.id === extraAccount.id) ? (
                <option value={extraAccount.id}>
                  {extraAccount.name} (diarsipkan)
                </option>
              ) : null}
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

          {hasActiveFilter ? (
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="close" size={18} />
                Atur ulang filter
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
