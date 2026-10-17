"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// Segment order follows the Stitch mockup (Pengeluaran, Pemasukan, Transfer),
// not the lib TRANSACTION_TYPES order. Each segment carries a Material Symbol
// and a type-colored active tone; meaning is label + glyph + tone together, so
// it never relies on color alone.
const SEGMENTS = [
  {
    value: "expense",
    label: "Pengeluaran",
    glyph: "arrow_upward",
    activeClass: "text-expense",
  },
  {
    value: "income",
    label: "Pemasukan",
    glyph: "arrow_downward",
    activeClass: "text-income",
  },
  {
    value: "transfer",
    label: "Transfer",
    glyph: "sync_alt",
    activeClass: "text-primary",
  },
] as const;

interface TransactionTypeSwitcherProps {
  value: string;
  onChange: (next: string) => void;
  // The id of the visible group label so the control is announced.
  labelId: string;
}

export function TransactionTypeSwitcher({
  value,
  onChange,
  labelId,
}: TransactionTypeSwitcherProps) {
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container-low p-1"
    >
      {SEGMENTS.map((segment) => {
        const selected = value === segment.value;
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(segment.value)}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? cn("bg-surface-container-lowest shadow-sm", segment.activeClass)
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <Icon name={segment.glyph} size={18} className="shrink-0" />
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
