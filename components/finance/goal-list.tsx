"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatGoalDate, getGoalIcon, type GoalView } from "@/lib/goals";
import { GoalProgress } from "@/components/finance/goal-progress";

interface GoalListProps {
  active: GoalView[];
  achieved: GoalView[];
  archived: GoalView[];
}

// Grouped goal list (Decision 3): "Target aktif", "Tercapai", and "Arsip"
// (the archive section only renders when it has entries). Each row links to the
// goal detail. Rows are compact and mobile-first; the icon is the only accent.
export function GoalList({ active, achieved, archived }: GoalListProps) {
  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 ? (
        <GoalSection title="Target aktif" goals={active} />
      ) : null}
      {achieved.length > 0 ? (
        <GoalSection title="Tercapai" goals={achieved} />
      ) : null}
      {archived.length > 0 ? (
        <GoalSection title="Arsip" goals={archived} />
      ) : null}
    </div>
  );
}

function GoalSection({ title, goals }: { title: string; goals: GoalView[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-3">
        {goals.map((goal) => (
          <GoalRow key={goal.id} goal={goal} />
        ))}
      </ul>
    </section>
  );
}

function GoalRow({ goal }: { goal: GoalView }) {
  const Icon = getGoalIcon(goal.icon);
  const targetDate = formatGoalDate(goal.target_date);

  return (
    <li>
      <Link
        href={`/goals/${goal.id}`}
        className="flex items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{goal.name}</span>
            {targetDate ? (
              <span className="text-sm text-muted-foreground">
                Target tanggal {targetDate}
              </span>
            ) : null}
          </div>
          <GoalProgress progress={goal.progress} size="sm" />
        </div>
        <ChevronRight
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </li>
  );
}
