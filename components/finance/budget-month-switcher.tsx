"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  formatMonthLabel,
  isMonthParam,
  shiftMonthParam,
} from "@/lib/budgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <section
      aria-label="Pilih bulan"
      className="flex items-center justify-between gap-2"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        aria-label="Bulan sebelumnya"
        onClick={() => goToMonth(shiftMonthParam(monthParam, -1))}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Button>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <Label htmlFor={monthId} className="sr-only">
          Pilih bulan
        </Label>
        <span className="text-base font-semibold">
          {formatMonthLabel(monthParam)}
        </span>
        <Input
          id={monthId}
          type="month"
          value={monthParam}
          onChange={(e) => goToMonth(e.target.value)}
          className="h-9 w-full max-w-[11rem]"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        aria-label="Bulan berikutnya"
        onClick={() => goToMonth(shiftMonthParam(monthParam, 1))}
      >
        <ChevronRight className="size-5" aria-hidden />
      </Button>
    </section>
  );
}
