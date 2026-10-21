"use client";

import { useState } from "react";

import type { GoalContributionRow } from "@/lib/goals";
import { ContributionRow } from "@/components/finance/contribution-row";

interface GoalContributionHistoryProps {
  goalId: string;
  contributions: GoalContributionRow[];
}

// Wraps the contribution rows in a Stitch card with one shared live region for
// action errors (a failed delete), mirroring the account manager surface.
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
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
        >
          {actionError}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-outline-variant rounded-xl bg-surface-container-lowest shadow-sm">
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
