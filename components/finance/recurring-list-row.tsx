"use client";

import { useTransition } from "react";
import Link from "next/link";

import {
  formatFrequency,
  formatRecurringDate,
  getTransactionTypeMeta,
  type RecurringRow,
} from "@/lib/recurring";
import {
  deleteRecurring,
  generateNow,
  setRecurringActive,
  type ActionResult,
} from "@/app/(app)/recurring/actions";
import { cn } from "@/lib/utils";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ToggleSwitch } from "@/components/transactions/toggle-switch";

// Transaction type -> Material Symbol glyph (same mapping as the ledger row):
// income inbound, expense outbound, transfer a swap. The type label text still
// comes from getTransactionTypeMeta.
const TRANSACTION_TYPE_GLYPH: Record<string, string> = {
  income: "arrow_downward",
  expense: "arrow_upward",
  transfer: "swap_horiz",
};

function transactionTypeGlyph(type: string): string {
  return TRANSACTION_TYPE_GLYPH[type] ?? "swap_horiz";
}

export interface RecurringRowView extends RecurringRow {
  accountName: string | null;
  destinationAccountName: string | null;
  categoryName: string | null;
}

interface RecurringListRowProps {
  template: RecurringRowView;
  onError: (message: string) => void;
}

// Stitch ledger card for a recurring template: a glyph circle, the name + an
// account line, a status pill, the signed amount with its type label, a
// schedule line (cadence + next-due date), and the real controls (pause/resume
// toggle, "Catat sekarang" for active items, Edit, Delete). Meaning is carried
// by glyph + sign + label + tone together, never color alone. All actions call
// the existing user-scoped server actions; nothing here promises auto-posting.
export function RecurringListRow({ template, onError }: RecurringListRowProps) {
  const [isPending, startTransition] = useTransition();
  const meta = getTransactionTypeMeta(template.transaction_type);
  const isTransfer = template.transaction_type === "transfer";
  const isExpense = template.transaction_type === "expense";
  const isIncome = template.transaction_type === "income";

  // Amount meaning is carried by sign + label + tone together, never color
  // alone: income "+Rp" (income tone), expense "-Rp" (expense tone), transfer
  // neutral with no sign.
  const amountValue = isExpense ? -template.amount : template.amount;
  const amountTone = isIncome ? "income" : isExpense ? "expense" : "default";

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) onError(result.message);
    });
  }

  function handleToggleActive(next: boolean) {
    run(() => setRecurringActive(template.id, next));
  }

  function handleGenerate() {
    run(() => generateNow(template.id));
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Hapus "${template.name}"? Transaksi yang sudah tercatat sebelumnya tetap tersimpan.`,
    );
    if (!confirmed) return;
    run(() => deleteRecurring(template.id));
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-md shadow-sm",
        !template.is_active && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
          aria-hidden
        >
          <Icon name={transactionTypeGlyph(template.transaction_type)} size={20} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body-md font-semibold text-on-surface">
              {template.name}
            </span>
            <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-label-xs text-on-surface-variant">
              {template.is_active ? "Aktif" : "Dijeda"}
            </span>
          </div>

          {isTransfer ? (
            <span className="flex min-w-0 items-center gap-1 text-body-sm text-on-surface-variant">
              <span className="truncate">
                {template.accountName ?? "Rekening"}
              </span>
              <Icon name="arrow_forward" size={14} className="shrink-0" />
              <span className="truncate">
                {template.destinationAccountName ?? "Rekening"}
              </span>
            </span>
          ) : (
            <span className="truncate text-body-sm text-on-surface-variant">
              {[template.categoryName, template.accountName]
                .filter(Boolean)
                .join(" \u00b7 ") || "Rekening"}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <AmountText
            value={amountValue}
            tone={amountTone}
            size="none"
            signed={!isTransfer}
            className="text-body-md font-semibold"
          />
          <span className="text-label-xs text-on-surface-variant">
            {meta.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 text-body-sm text-on-surface-variant">
        <span>{formatFrequency(template.frequency, template.interval_count)}</span>
        <span>Jatuh tempo: {formatRecurringDate(template.next_due_date)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3">
        <label className="flex min-h-11 items-center gap-2 text-body-sm text-on-surface">
          <ToggleSwitch
            checked={template.is_active}
            onCheckedChange={(next) => handleToggleActive(next === true)}
            disabled={isPending}
            aria-label={`Aktif untuk ${template.name}`}
          />
          Aktif
        </label>

        {template.is_active ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11"
            onClick={handleGenerate}
            disabled={isPending}
          >
            <Icon name="add" size={18} />
            Catat sekarang
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11"
            onClick={() => handleToggleActive(true)}
            disabled={isPending}
          >
            <Icon name="play_arrow" size={18} />
            Aktifkan Kembali
          </Button>
        )}

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-11"
        >
          <Link href={`/recurring/${template.id}/edit`}>
            <Icon name="edit" size={18} />
            Edit
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-11 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
          aria-label={`Hapus ${template.name}`}
        >
          <Icon name="delete" size={18} />
        </Button>
      </div>
    </li>
  );
}
