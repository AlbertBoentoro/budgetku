import { cn } from "@/lib/utils";
import type { GoalProgress as GoalProgressData } from "@/lib/goals";
import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

interface GoalProgressProps {
  progress: GoalProgressData;
  // "sm" is the compact list-card layout; "lg" is the prominent detail layout.
  size?: "sm" | "lg";
}

// Renders the progress line with real numbers (terkumpul / target, percent,
// sisa) plus a token progress bar. The bar is aria-hidden; meaning always lives
// in the text beside it (saved/target, percent, achieved/sisa), never in color
// alone. Both list cards and the detail overview share this component.
export function GoalProgress({ progress, size = "sm" }: GoalProgressProps) {
  const { saved, target, remaining, barPercent, isAchieved } = progress;
  // Whole-percent for the label (floor so "100%" means truly reached).
  const pct = Math.floor(barPercent);
  const amountSize = size === "lg" ? "text-currency-body" : "text-body-md";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <AmountText
          value={saved}
          size="none"
          className={cn(amountSize, "text-on-surface")}
        />
        <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-label-xs font-medium text-on-surface-variant tabular-nums">
          {pct}%
        </span>
      </div>

      <p className="text-body-sm text-on-surface-variant">
        Target <AmountText value={target} size="none" className="text-body-sm" />
      </p>

      {/* Token bar: width reflects progress but conveys nothing on its own; the
          numbers above and the status/sisa line below carry the meaning. */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low"
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
        <span className="flex items-center gap-1.5 text-body-sm text-income">
          <Icon name="check_circle" size={16} />
          Target tercapai
        </span>
      ) : (
        <span className="text-body-sm text-on-surface-variant">
          Sisa{" "}
          <AmountText value={remaining} size="none" className="text-body-sm" />{" "}
          lagi
        </span>
      )}
    </div>
  );
}
