"use client";

import { useState } from "react";

import type { GoalContributionRow } from "@/lib/goals";
import { ContributionRow } from "@/components/finance/contribution-row";

interface GoalContributionHistoryProps {
  goalId: string;
  contributions: GoalContributionRow[];
}

// Wraps the contribution rows with one shared live region for action errors
// (a failed delete), mirroring the budget item list.
export function GoalContributionHistory({
  goalId,
  contributions,
}: GoalContributionHistoryProps) {
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {contributions.map((contribution) => (
          <ContributionRow
            key={contribution.id}
            contribution={contribution}
            goalId={goalId}
            onError={setActionError}
          />
        ))}
      </ul>
    </div>
  );
}
