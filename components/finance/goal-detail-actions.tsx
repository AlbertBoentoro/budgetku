"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

import {
  deleteGoal,
  setGoalStatus,
  type ActionResult,
} from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";

interface GoalDetailActionsProps {
  goalId: string;
  // Current stored status, so we can offer "Arsipkan" vs "Pulihkan".
  status: string;
}

// Archive/restore and hard-delete controls for a goal (Decision 4). Errors
// surface in a shared live region; a successful delete returns to the list.
export function GoalDetailActions({ goalId, status }: GoalDetailActionsProps) {
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
      "Hapus target ini? Seluruh riwayat kontribusinya juga akan dihapus dan tidak bisa dikembalikan.",
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
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={handleToggleArchive}
          disabled={isPending}
        >
          {isArchived ? (
            <>
              <ArchiveRestore aria-hidden />
              Pulihkan
            </>
          ) : (
            <>
              <Archive aria-hidden />
              Arsipkan
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 aria-hidden />
          Hapus
        </Button>
      </div>
    </div>
  );
}
