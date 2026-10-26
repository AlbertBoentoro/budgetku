"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { GoalProgress as GoalProgressData, GoalStatus } from "@/lib/goals";
import { AmountText } from "@/components/finance/amount-text";
import { GoalProgress } from "@/components/finance/goal-progress";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Serializable per-card view model built on the server (no lucide component,
// no Map). The client card maps over these.
export interface GoalCardView {
  id: string;
  name: string;
  glyph: string;
  // Linked account name, only when the goal has an account_id that resolves.
  accountName: string | null;
  // Formatted "batas waktu" date, or null when the goal has no target_date.
  targetDate: string | null;
  group: GoalStatus;
  progress: GoalProgressData;
}

// Stitch goal card for the list buckets. The whole card links to the detail
// screen; the "Nabung" button links to the contribute flow and stops the click
// from also following the card link. Achieved/archived cards get an honest
// status line (text + glyph, never color alone).
export function GoalCard({ goal }: { goal: GoalCardView }) {
  const { progress } = goal;
  const isAchieved = goal.group === "achieved";
  const isArchived = goal.group === "archived";
  const pct = Math.floor(progress.barPercent);

  return (
    <li>
      <Link
        href={`/goals/${goal.id}`}
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isArchived && "opacity-70",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
            <Icon name={goal.glyph} size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-title-md text-on-surface">
              {goal.name}
            </span>
            {goal.accountName ? (
              <span className="truncate text-body-sm text-on-surface-variant">
                {goal.accountName}
              </span>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-label-xs font-medium text-on-surface-variant tabular-nums">
            {pct}%
          </span>
        </div>

        <GoalProgress progress={progress} size="sm" />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
          {isAchieved ? (
            <span>
              Total dana terkumpul{" "}
              <AmountText
                value={progress.saved}
                size="none"
                className="text-body-sm"
              />
            </span>
          ) : isArchived ? (
            <span>Diarsipkan</span>
          ) : null}
          {goal.targetDate ? (
            <span>Batas waktu: {goal.targetDate}</span>
          ) : null}
        </div>

        {goal.group === "active" ? (
          <Button
            asChild
            variant="outline"
            className="h-11 w-full"
            // Stop the inner link from also triggering the card link.
            onClick={(event) => event.stopPropagation()}
          >
            <Link href={`/goals/${goal.id}/contribute`}>
              <Icon name="savings" size={18} />
              Nabung
            </Link>
          </Button>
        ) : null}
      </Link>
    </li>
  );
}
