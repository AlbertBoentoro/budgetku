"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  ALL_MONTHS_PARAM,
  TRANSACTION_TYPES,
  parseTransactionFilters,
  type AccountRow,
} from "@/lib/transactions";
import type { CategoryRow } from "@/lib/transactions";
import { formatMonthLabel } from "@/lib/budgets";
import { MonthPickerPanel } from "@/components/finance/month-picker-panel";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Same native-select styling the account form uses, kept in one place so the
// filter selects match the rest of the app exactly.
const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

// Shared chip styling (44px tap target); active vs inactive differ in fill +
// text tone, so the active chip is never conveyed by color alone (the selected
// filter is also reflected in the URL and the list below). The ring offset
// keeps the focus ring visible on a filled chip, which has the ring's color.
const chipBase =
  "inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-4 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const chipActive = "bg-primary text-primary-foreground";
const chipInactive =
  "bg-surface-container text-on-surface-variant hover:bg-surface-container-high";

const FILTER_KEYS = ["q", "type", "account", "category", "month"] as const;

interface TransactionFiltersProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  // The current month ("YYYY-MM") from the server render, so the chip, the
  // picker, and the list agree on what "this month" is.
  currentMonth: string;
  // An archived account that is the active (validated) filter. It is not in
  // the active list, so it is offered as an extra option to keep the select
  // in sync with the URL.
  extraAccount?: { id: string; name: string } | null;
}

export function TransactionFilters({
  accounts,
  categories,
  currentMonth,
  extraAccount = null,
}: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchId = useId();
  const typeId = useId();
  const accountId = useId();
  const categoryId = useId();
  const monthPanelId = useId();

  // Read the live URL values so the controls reflect a shared/bookmarked URL.
  const currentQ = searchParams.get("q") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentAccount = searchParams.get("account") ?? "";
  const currentCategory = searchParams.get("category") ?? "";

  const hasActiveFilter = FILTER_KEYS.some((key) =>
    Boolean(searchParams.get(key)),
  );

  // The month the list shows, resolved the same way as on the server: the
  // ?month= filter, every month for ?month=all, otherwise the current month.
  // The chip is filled while the URL picks something other than that default.
  const paramsRecord = Object.fromEntries(searchParams.entries());
  const parsed = parseTransactionFilters(paramsRecord);
  const showsAllMonths =
    (searchParams.get("month") ?? "").trim() === ALL_MONTHS_PARAM;
  const listMonth = showsAllMonths ? null : (parsed.month ?? currentMonth);
  const monthChipLabel = showsAllMonths
    ? "Semua bulan"
    : parsed.month
      ? formatMonthLabel(parsed.month)
      : `Bulan Ini \u00b7 ${formatMonthLabel(currentMonth)}`;

  // One panel at a time below the chip row: the month picker, or the account
  // and category filters. The filter panel opens on load when one of its
  // filters is already set in the URL.
  const [openPanel, setOpenPanel] = useState<"month" | "filter" | null>(
    currentAccount || currentCategory ? "filter" : null,
  );
  const monthChipRef = useRef<HTMLButtonElement>(null);

  function toggleMonthPanel() {
    setOpenPanel((panel) => (panel === "month" ? null : "month"));
  }

  function closeMonthPanel() {
    setOpenPanel(null);
    monthChipRef.current?.focus();
  }

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

  // Picking the current month returns to the default view, so the URL stays
  // clean and the chip reads "Bulan Ini" again.
  function selectMonth(month: string) {
    updateParam("month", month === currentMonth ? "" : month);
    closeMonthPanel();
  }

  function showAllMonths() {
    updateParam("month", ALL_MONTHS_PARAM);
    closeMonthPanel();
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

      <div className="-mx-space-xs flex flex-wrap gap-2 px-space-xs pb-1">
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

        {/* Filled while a month filter narrows the list, like the type
            chips. The chevron shows that the chip opens the month picker. */}
        <button
          ref={monthChipRef}
          type="button"
          onClick={toggleMonthPanel}
          onKeyDown={(event) => {
            if (event.key === "Escape" && openPanel === "month") {
              closeMonthPanel();
            }
          }}
          aria-label={`Pilih bulan: ${monthChipLabel}`}
          aria-expanded={openPanel === "month"}
          aria-controls={openPanel === "month" ? monthPanelId : undefined}
          className={cn(
            chipBase,
            showsAllMonths || parsed.month ? chipActive : chipInactive,
          )}
        >
          <Icon name="calendar_month" size={16} />
          {monthChipLabel}
          <Icon
            name={openPanel === "month" ? "expand_less" : "expand_more"}
            size={18}
          />
        </button>

        <button
          type="button"
          onClick={() =>
            setOpenPanel((panel) => (panel === "filter" ? null : "filter"))
          }
          aria-expanded={openPanel === "filter"}
          aria-controls={`${typeId}-panel`}
          className={cn(
            chipBase,
            openPanel === "filter" ? chipActive : chipInactive,
          )}
        >
          <Icon name="tune" size={16} />
          Filter
        </button>
      </div>

      {openPanel === "month" ? (
        <MonthPickerPanel
          id={monthPanelId}
          selectedMonth={listMonth}
          todayMonth={currentMonth}
          onSelect={selectMonth}
          onShowAll={showAllMonths}
          onClose={closeMonthPanel}
        />
      ) : null}

      {/* Same bordered surface as the month picker, so both panels opened
          from this row read as one family and stay visible in light mode. */}
      {openPanel === "filter" ? (
        <div
          id={`${typeId}-panel`}
          className="grid grid-cols-1 gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 min-[375px]:grid-cols-2"
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
