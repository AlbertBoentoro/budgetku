"use client";

import { useTransition } from "react";
import Link from "next/link";

import {
  deleteTransaction,
  type ActionResult,
} from "@/app/(app)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  // The transaction id to edit/delete.
  id: string;
  // Used only for the accessible label and the delete confirmation copy.
  label: string;
  // Shared live region on the list surfaces a failed delete.
  onError: (message: string) => void;
}

// Isolated client menu for a ledger row: edit link + delete via the unchanged
// deleteTransaction server action. Kept small so the row/grouping around it can
// stay server-rendered. Material Symbols only (no lucide).
export function RowActionsMenu({ id, label, onError }: RowActionsMenuProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    // Plain confirmation, no Dialog dependency; the server re-checks ownership
    // before deleting.
    const confirmed = window.confirm(
      `Hapus transaksi "${label}"? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result: ActionResult = await deleteTransaction(id);
      if (!result.ok) {
        onError(result.message);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-on-surface-variant"
          aria-label={`Aksi untuk ${label}`}
          disabled={isPending}
        >
          <Icon name="more_vert" size={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/transactions/${id}/edit`}>
            <Icon name="edit" size={18} />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleDelete}
          className="text-expense focus:text-expense"
        >
          <Icon name="delete" size={18} />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
