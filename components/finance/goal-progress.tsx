import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GoalProgress as GoalProgressData } from "@/lib/goals";
import { AmountText } from "@/components/finance/amount-text";

interface GoalProgressProps {
  progress: GoalProgressData;
  // "md" on the detail page, "sm" compact on list rows.
  size?: "sm" | "md";
}

// Renders the progress line with real numbers (terkumpul / target, percent,
// sisa) plus a purely decorative bar. The bar is aria-hidden; meaning always
// lives in the text beside it, never in color alone.
export function GoalProgress({ progress, size = "md" }: GoalProgressProps) {
  const { saved, target, remaining, barPercent, isAchieved } = progress;
  // Whole-percent for the label (floor so "100%" means truly reached).
  const percentLabel = `${Math.floor(barPercent)}%`;
  const amountSize = size === "sm" ? "sm" : "md";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <span className="text-sm text-muted-foreground tabular-nums">
          Terkumpul <AmountText value={saved} size={amountSize} /> /{" "}
          <AmountText value={target} size={amountSize} />
        </span>
        <span className="text-sm font-medium tabular-nums">{percentLabel}</span>
      </div>

      {/* Decorative bar: width reflects progress but conveys nothing on its
          own; the numbers above and the status/sisa line below carry meaning. */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full",
            isAchieved ? "bg-income" : "bg-primary",
          )}
          style={{ width: `${barPercent}%` }}
        />
      </div>

      {isAchieved ? (
        <span className="flex items-center gap-1.5 text-sm text-income">
          <Check className="size-4 shrink-0" aria-hidden />
          Target tercapai
        </span>
      ) : (
        <span className="text-sm text-muted-foreground tabular-nums">
          Sisa <AmountText value={remaining} size="sm" />
        </span>
      )}
    </div>
  );
}
