"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  formatMonthLabel,
  isMonthParam,
  shiftMonthParam,
} from "@/lib/budgets";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";

interface BudgetMonthSwitcherProps {
  monthParam: string;
}

export function BudgetMonthSwitcher({ monthParam }: BudgetMonthSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const monthId = useId();

  // Write ?month=, preserving any other params (mirrors the transaction
  // filters URL building).
  function goToMonth(nextMonth: string) {
    if (!isMonthParam(nextMonth)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonth);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <section aria-label="Pilih bulan" className="flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
        <button
          type="button"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Bulan sebelumnya"
          onClick={() => goToMonth(shiftMonthParam(monthParam, -1))}
        >
          <Icon name="chevron_left" size={22} />
        </button>

        <span className="min-w-[8rem] text-center text-title-md text-on-surface">
          {formatMonthLabel(monthParam)}
        </span>
        {/* Keeps the native month picker + keyboard selection available while
            the visible control is the pill; hidden from sighted layout. */}
        <Label htmlFor={monthId} className="sr-only">
          Pilih bulan
        </Label>
        <Input
          id={monthId}
          type="month"
          value={monthParam}
          onChange={(e) => goToMonth(e.target.value)}
          className="sr-only"
        />

        <button
          type="button"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Bulan berikutnya"
          onClick={() => goToMonth(shiftMonthParam(monthParam, 1))}
        >
          <Icon name="chevron_right" size={22} />
        </button>
      </div>
    </section>
  );
}
