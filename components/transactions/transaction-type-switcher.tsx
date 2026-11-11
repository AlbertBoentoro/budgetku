"use client";

import { cn } from "@/lib/utils";

const SEGMENTS = [
  { value: "expense", label: "Pengeluaran", activeClass: "border-expense text-expense bg-expense/10" },
  { value: "income", label: "Pemasukan", activeClass: "border-income text-income bg-income/10" },
  { value: "transfer", label: "Transfer", activeClass: "border-primary text-on-surface bg-primary/10" },
] as const;

interface TransactionTypeSwitcherProps {
  value: string;
  onChange: (next: string) => void;
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
      className="grid w-full min-w-0 grid-cols-3 gap-1 border-b border-outline-variant"
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
              "flex min-h-12 min-w-0 items-center justify-center border-b-[3px] px-1 text-center text-[clamp(0.75rem,3.3vw,1rem)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? segment.activeClass
                : "border-transparent text-on-surface-variant hover:bg-surface-container-low",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
