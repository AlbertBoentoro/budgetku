"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

import {
  deleteContribution,
  type ActionResult,
} from "@/app/(app)/goals/actions";
import { formatGoalDate, type GoalContributionRow } from "@/lib/goals";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";

interface ContributionRowProps {
  contribution: GoalContributionRow;
  goalId: string;
  onError: (message: string) => void;
}

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
      <div className="flex min-w-0 flex-1 flex-col">
        <AmountText value={safeAmount} size="md" />
        <span className="text-sm text-muted-foreground">
          {date ?? "Tanpa tanggal"}
          {contribution.note ? ` · ${contribution.note}` : ""}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 text-destructive hover:text-destructive"
        aria-label="Hapus kontribusi"
        onClick={handleDelete}
        disabled={isPending}
      >
        <Trash2 className="size-5" aria-hidden />
      </Button>
    </li>
  );
}
