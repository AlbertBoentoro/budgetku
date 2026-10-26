import Link from "next/link";

import {
  getTransactionTypeMeta,
  type TransactionRow,
} from "@/lib/transactions";
import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";
import { RowActionsMenu } from "@/components/transactions/row-actions-menu";
import { getTransactionDisplayLabel } from "@/lib/transactions/display-label";

// Transaction type -> Material Symbol glyph (same mapping as the dashboard
// recent row): income inbound, expense outbound, transfer a swap. The type
// label text still comes from getTransactionTypeMeta.
const TRANSACTION_TYPE_GLYPH: Record<string, string> = {
  income: "arrow_downward",
  expense: "arrow_upward",
  transfer: "swap_horiz",
};

function transactionTypeGlyph(type: string): string {
  return TRANSACTION_TYPE_GLYPH[type] ?? "swap_horiz";
}

// The view shape the page builds: a transaction plus resolved display names.
// Kept here so the page and list import it from one place.
export interface TransactionRowView extends TransactionRow {
  accountName: string | null;
  destinationAccountName: string | null;
  categoryName: string | null;
}

interface TransactionLedgerRowProps {
  transaction: TransactionRowView;
  // Shared live region on the list surfaces a failed delete from the menu.
  onError: (message: string) => void;
}

// Stitch ledger row: an icon circle, the primary label + a quiet meta line, the
// signed amount, and an isolated edit/delete menu. The whole label area links
// to the edit screen (preserving the prior navigation to the transaction).
// Meaning is carried by glyph + sign + label + tone together, never color
// alone, and no amount or label is ever fabricated.
export function TransactionLedgerRow({
  transaction,
  onError,
}: TransactionLedgerRowProps) {
  const meta = getTransactionTypeMeta(transaction.transaction_type);
  const isTransfer = transaction.transaction_type === "transfer";
  const isExpense = transaction.transaction_type === "expense";
  const isIncome = transaction.transaction_type === "income";

  const primaryLabel = getTransactionDisplayLabel(
    transaction,
    transaction.categoryName,
    meta.label,
  );

  // Expense negated so it reads "-Rp"; income positive "+Rp"; transfer neutral,
  // no sign. The stored amount is never scaled.
  const amountValue = isExpense ? -transaction.amount : transaction.amount;
  const amountTone = isIncome ? "income" : isExpense ? "expense" : "default";

  // Meta line: for a transfer, source -> destination; otherwise category +
  // account. The date lives in the day-group header, so rows stay quiet.
  const metaText = isTransfer
    ? `${transaction.accountName ?? "Rekening"} \u2192 ${transaction.destinationAccountName ?? "Rekening"}`
    : [transaction.categoryName, transaction.accountName]
        .filter(Boolean)
        .join(" \u00b7 ");

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link
        href={`/transactions/${transaction.id}/edit`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name={transactionTypeGlyph(transaction.transaction_type)} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-md text-on-surface">
            {primaryLabel}
          </span>
          {metaText ? (
            <span className="truncate text-body-sm text-on-surface-variant">
              {metaText}
            </span>
          ) : null}
        </span>
        <AmountText
          value={amountValue}
          tone={amountTone}
          size="none"
          signed={!isTransfer}
          className="text-body-md font-semibold"
        />
      </Link>
      <RowActionsMenu
        id={transaction.id}
        label={primaryLabel}
        onError={onError}
      />
    </li>
  );
}
