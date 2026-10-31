"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { formatMonthLabel } from "@/lib/budgets";
import { Icon } from "@/components/ui/icon";

// Short Indonesian month names for the grid. A fixed list, so the grid does
// not depend on the browser's locale data.
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

// Date.UTC reads years below 100 as 19xx, so the year stepper stays in a range
// where every "YYYY-MM" value formats correctly.
const MIN_YEAR = 1970;
const MAX_YEAR = 9999;

// The active: fills give touch users visible feedback that a tap registered.
const stepperClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container active:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

// Every month keeps a 1px border so marking the current month does not shift
// the grid. The ring offset keeps the focus ring visible on the filled month.
const monthBase =
  "inline-flex h-11 min-w-0 items-center justify-center rounded-lg border text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";
const monthIdle =
  "border-transparent text-on-surface hover:bg-surface-container active:bg-surface-container-high";
const monthToday =
  "border-input text-on-surface hover:bg-surface-container active:bg-surface-container-high";
const monthSelected = "border-transparent bg-primary text-primary-foreground";

function clampYear(year: number): number {
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
}

interface MonthPickerPanelProps {
  id: string;
  // The month filter from the URL ("YYYY-MM"), or null while every month is
  // shown.
  selectedMonth: string | null;
  // The current month ("YYYY-MM"), read when the panel was opened.
  todayMonth: string;
  onSelect: (month: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function MonthPickerPanel({
  id,
  selectedMonth,
  todayMonth,
  onSelect,
  onClear,
  onClose,
}: MonthPickerPanelProps) {
  const startMonth = selectedMonth ?? todayMonth;
  const [viewYear, setViewYear] = useState(() =>
    clampYear(Number(startMonth.slice(0, 4))),
  );
  const startButtonRef = useRef<HTMLButtonElement>(null);

  // The panel mounts only when the user opens it, so focus moves to the month
  // it starts on and keyboard users land inside the grid.
  useEffect(() => {
    startButtonRef.current?.focus();
  }, []);

  // Capped at sm:max-w-sm so the year arrows stay next to the year on wide
  // screens; phones use the full width.
  return (
    <div
      id={id}
      role="group"
      aria-label="Pilih bulan"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="flex w-full flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:max-w-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Tahun sebelumnya"
          disabled={viewYear <= MIN_YEAR}
          onClick={() => setViewYear((year) => clampYear(year - 1))}
          className={stepperClass}
        >
          <Icon name="chevron_left" size={22} />
        </button>
        <span
          aria-live="polite"
          className="text-title-md tabular-nums text-on-surface"
        >
          {viewYear}
        </span>
        <button
          type="button"
          aria-label="Tahun berikutnya"
          disabled={viewYear >= MAX_YEAR}
          onClick={() => setViewYear((year) => clampYear(year + 1))}
          className={stepperClass}
        >
          <Icon name="chevron_right" size={22} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 min-[375px]:grid-cols-4">
        {MONTH_NAMES.map((name, index) => {
          const value = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
          const isSelected = value === selectedMonth;
          const isToday = value === todayMonth;
          return (
            <button
              key={value}
              ref={value === startMonth ? startButtonRef : undefined}
              type="button"
              aria-label={formatMonthLabel(value)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onSelect(value)}
              className={cn(
                monthBase,
                isSelected ? monthSelected : isToday ? monthToday : monthIdle,
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      {selectedMonth ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 items-center rounded-md px-3 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tampilkan semua bulan
          </button>
        </div>
      ) : null}
    </div>
  );
}
