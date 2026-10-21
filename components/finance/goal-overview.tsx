"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/lib/goals";
import { AmountText } from "@/components/finance/amount-text";
import { GoalCard, type GoalCardView } from "@/components/finance/goal-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Precomputed, serializable aggregate figures (real data from the server).
export interface GoalAggregate {
  // Sum of saved across ACTIVE goals and sum of their targets.
  savedActive: number;
  targetActive: number;
  // clamp(savedActive / targetActive * 100, 0, 100), divide-by-zero guarded.
  barPercent: number;
  // Count of active goals ("Target Berjalan").
  activeCount: number;
}

interface GoalOverviewProps {
  aggregate: GoalAggregate;
  active: GoalCardView[];
  achieved: GoalCardView[];
  archived: GoalCardView[];
}

type Tab = GoalStatus;

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  active: {
    title: "Belum ada target berjalan",
    description: "Buat target baru untuk mulai menabung.",
  },
  achieved: {
    title: "Belum ada target tercapai",
    description: "Target yang mencapai 100% akan muncul di sini.",
  },
  archived: {
    title: "Belum ada target diarsipkan",
    description: "Target yang kamu arsipkan akan muncul di sini.",
  },
};

export function GoalOverview({
  aggregate,
  active,
  achieved,
  archived,
}: GoalOverviewProps) {
  const [tab, setTab] = useState<Tab>("active");

  const pct = Math.floor(aggregate.barPercent);
  const groups: Record<Tab, GoalCardView[]> = { active, achieved, archived };
  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "active", label: "Aktif", count: active.length },
    { value: "achieved", label: "Tercapai", count: achieved.length },
    { value: "archived", label: "Arsip", count: archived.length },
  ];
  const current = groups[tab];

  return (
    <div className="flex flex-col gap-6">
      {/* Cumulative banner over the real active goals. */}
      <section
        aria-label="Akumulasi target aktif"
        className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-lg shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-2 text-label-xs uppercase text-on-surface-variant">
            <Icon name="savings" size={18} className="text-primary" />
            Akumulasi Target Aktif
          </span>
          <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-label-xs font-medium text-on-surface-variant tabular-nums">
            {pct}% Tercapai
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <AmountText
            value={aggregate.savedActive}
            size="none"
            className="text-currency-display text-on-surface"
          />
          <span className="text-body-sm text-on-surface-variant">
            dari total target{" "}
            <AmountText
              value={aggregate.targetActive}
              size="none"
              className="text-body-sm"
            />
          </span>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Akumulasi target tercapai ${pct} persen`}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${aggregate.barPercent}%` }}
          />
        </div>

        <p className="text-body-sm text-on-surface-variant">
          {aggregate.activeCount} Target Berjalan
        </p>
      </section>

      {/* Primary action. */}
      <Button asChild className="h-11 w-full">
        <Link href="/goals/new">
          <Icon name="add" size={20} />
          Target Baru
        </Link>
      </Button>

      {/* Segmented filter chips with real counts. */}
      <div
        role="group"
        aria-label="Saring target"
        className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container-low p-1"
      >
        {tabs.map((t) => {
          const selected = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(t.value)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {t.label} ({t.count})
            </button>
          );
        })}
      </div>

      {current.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {current.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-lowest p-lg text-center shadow-sm">
          <p className="text-title-md text-on-surface">
            {EMPTY_COPY[tab].title}
          </p>
          <p className="max-w-xs text-body-sm text-on-surface-variant">
            {EMPTY_COPY[tab].description}
          </p>
        </div>
      )}
    </div>
  );
}
