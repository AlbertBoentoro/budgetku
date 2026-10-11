"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ArrowRight, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { getTransactionTypeMeta, type TransactionRow } from "@/lib/transactions";
import {
  deleteTransaction,
  type ActionResult,
} from "@/app/(app)/transactions/actions";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Date-only formatter (e.g. "4 Mar 2025"): the ledger compares dates, not
// exact timestamps, so the time of day is left off to keep rows quiet.
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

export interface TransactionRowView extends TransactionRow {
  accountName: string | null;
  destinationAccountName: string | null;
  categoryName: string | null;
}

interface TransactionListRowProps {
  transaction: TransactionRowView;
  onError: (message: string) => void;
}

export function TransactionListRow({
  transaction,
  onError,
}: TransactionListRowProps) {
  const [isPending, startTransition] = useTransition();
  const meta = getTransactionTypeMeta(transaction.transaction_type);
  const Icon = meta.icon;
  const isTransfer = transaction.transaction_type === "transfer";
  const isExpense = transaction.transaction_type === "expense";
  const isIncome = transaction.transaction_type === "income";

  // Primary label falls back through the most descriptive field available so a
  // row is never blank: merchant, then free-text note, then category, then the
  // transaction type label.
  const primaryLabel =
    transaction.merchant ||
    transaction.description ||
    transaction.categoryName ||
    meta.label;

  // Amount presentation. Meaning is carried by sign and tone together, never by
  // color alone: income shows "+Rp", expense shows "-Rp" (value negated), and a
  // transfer stays neutral with no sign. The stored amount is never scaled.
  const amountValue = isExpense ? -transaction.amount : transaction.amount;
  const amountTone = isIncome ? "income" : isExpense ? "expense" : "default";

  // Quieter metadata line for non-transfer rows: category and account (when
  // known) followed by the date, joined by a thin separator.
  const metaParts = [
    transaction.categoryName,
    transaction.accountName,
    formatDate(transaction.transaction_at),
  ].filter(Boolean);

  function handleDelete() {
    // Plain confirmation, no Dialog dependency. The server re-checks ownership
    // before deleting.
    const confirmed = window.confirm(
      `Hapus transaksi "${primaryLabel}"? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result: ActionResult = await deleteTransaction(transaction.id);
      if (!result.ok) {
        onError(result.message);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{primaryLabel}</span>
        {isTransfer ? (
          <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <span className="truncate">
              {transaction.accountName ?? "Rekening"}
            </span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {transaction.destinationAccountName ?? "Rekening"}
            </span>
            <span className="shrink-0">
              {" · "}
              {formatDate(transaction.transaction_at)}
            </span>
          </span>
        ) : (
          <span className="truncate text-sm text-muted-foreground">
            {metaParts.join(" · ")}
          </span>
        )}
      </div>

      <AmountText
        value={amountValue}
        tone={amountTone}
        size="sm"
        signed={!isTransfer}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Aksi untuk ${primaryLabel}`}
            disabled={isPending}
          >
            <MoreVertical className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/transactions/${transaction.id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 aria-hidden />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
