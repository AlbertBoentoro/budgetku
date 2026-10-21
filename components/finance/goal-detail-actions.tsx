"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  deleteGoal,
  setGoalStatus,
  type ActionResult,
} from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GoalDetailActionsProps {
  goalId: string;
  // Current stored status, so we can offer "Arsipkan" vs "Pulihkan".
  status: string;
  // Goal name for the delete confirmation copy.
  name: string;
}

// More-menu for a goal detail: Edit, archive/restore (existing setGoalStatus),
// and hard-delete (existing deleteGoal). Errors surface in a shared live region;
// a successful delete returns to the list. No "Kalkulasi Ulang" — progress is
// always computed live from real contributions, so there is nothing to recompute.
export function GoalDetailActions({
  goalId,
  status,
  name,
}: GoalDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isArchived = status === "archived";

  function handleToggleArchive() {
    setError(null);
    const nextStatus = isArchived ? "active" : "archived";
    startTransition(async () => {
      const result: ActionResult = await setGoalStatus(goalId, nextStatus);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    setError(null);
    const confirmed = window.confirm(
      `Hapus target "${name}"? Seluruh riwayat kontribusinya juga akan dihapus dan tidak bisa dikembalikan.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result: ActionResult = await deleteGoal(goalId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/goals");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-on-surface-variant"
            aria-label="Aksi target"
            disabled={isPending}
          >
            <Icon name="more_vert" size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/goals/${goalId}/edit`}>
              <Icon name="edit" size={18} />
              Edit Target
            </Link>
          </DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem onSelect={handleToggleArchive}>
              <Icon name="unarchive" size={18} />
              Pulihkan Target
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={handleToggleArchive}>
              <Icon name="archive" size={18} />
              Arsipkan Target
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleDelete}
            className="text-expense focus:text-expense"
          >
            <Icon name="delete" size={18} />
            Hapus Target
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error ? (
        <p
          role="alert"
          className="w-full rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
