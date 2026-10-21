"use client";

import { useTransition } from "react";

import {
  deleteContribution,
  type ActionResult,
} from "@/app/(app)/goals/actions";
import { formatGoalDate, type GoalContributionRow } from "@/lib/goals";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface ContributionRowProps {
  contribution: GoalContributionRow;
  goalId: string;
  onError: (message: string) => void;
}

// Stitch ledger row for one contribution: a savings glyph + note/date on the
// left, the amount as a signed emerald "+Rp..." on the right (sign + tone +
// label carry the income meaning, never color alone), and a per-row delete
// wired to the unchanged deleteContribution action.
export function ContributionRow({
  contribution,
  goalId,
  onError,
}: ContributionRowProps) {
  const [isPending, startTransition] = useTransition();
  const date = formatGoalDate(contribution.contributed_at);
  const amount = Number(contribution.amount);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  function handleDelete() {
    const confirmed = window.confirm(
      "Hapus kontribusi ini? Tindakan ini tidak bisa dibatalkan.",
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result: ActionResult = await deleteContribution(
        contribution.id,
        goalId,
      );
      if (!result.ok) {
        onError(result.message);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name="savings" size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md text-on-surface">
          {contribution.note ? contribution.note : "Kontribusi"}
        </span>
        <span className="truncate text-body-sm text-on-surface-variant">
          {date ?? "Tanpa tanggal"}
        </span>
      </div>
      <AmountText
        value={safeAmount}
        tone="income"
        signed
        size="none"
        className="shrink-0 text-currency-body"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 text-on-surface-variant hover:text-destructive"
        aria-label="Hapus kontribusi"
        onClick={handleDelete}
        disabled={isPending}
      >
        <Icon name="delete" size={20} />
      </Button>
    </li>
  );
}
