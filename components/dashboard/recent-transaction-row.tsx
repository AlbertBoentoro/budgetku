import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";
import {
  getTransactionTypeMeta,
  type TransactionRow,
} from "@/lib/transactions";
import { getTransactionDisplayLabel } from "@/lib/transactions/display-label";

// Transaction type -> Material Symbol glyph, local to the dashboard. income
// reads as an inbound arrow, expense as outbound, transfer as a swap. The
// shared getTransactionTypeMeta returns lucide icons, so only the glyph source
// changes here; the type label text still comes from getTransactionTypeMeta.
const TRANSACTION_TYPE_GLYPH: Record<string, string> = {
  income: "arrow_downward",
  expense: "arrow_upward",
  transfer: "swap_horiz",
};

function transactionTypeGlyph(type: string): string {
  return TRANSACTION_TYPE_GLYPH[type] ?? "swap_horiz";
}

// Date-only formatter (e.g. "4 Mar 2025"), matching the ledger row so recent
// transactions read the same on the dashboard as on the transactions page.
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

interface RecentTransactionRowProps {
  transaction: TransactionRow;
  accountName: string | null;
  destinationAccountName: string | null;
  categoryName: string | null;
}

// Read-only recent-transaction row. Reuses the ledger's amount formatting,
// transaction metadata, and shared label fallback. The dashboard is a glance
// view, so there are no edit/delete actions.
export function RecentTransactionRow({
  transaction,
  accountName,
  destinationAccountName,
  categoryName,
}: RecentTransactionRowProps) {
  const meta = getTransactionTypeMeta(transaction.transaction_type);
  const isTransfer = transaction.transaction_type === "transfer";
  const isExpense = transaction.transaction_type === "expense";
  const isIncome = transaction.transaction_type === "income";

  const primaryLabel = getTransactionDisplayLabel(
    transaction,
    categoryName,
    meta.label,
  );

  // Expense negated so it reads "-Rp"; income positive so it reads "+Rp"; a
  // transfer stays neutral with no sign. The stored amount is never scaled.
  const amountValue = isExpense ? -transaction.amount : transaction.amount;
  const amountTone = isIncome ? "income" : isExpense ? "expense" : "default";

  const metaParts = [
    categoryName,
    accountName,
    formatDate(transaction.transaction_at),
  ].filter(Boolean);

  return (
    <li className="flex min-h-[52px] items-center gap-3 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={transactionTypeGlyph(transaction.transaction_type)} size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md text-on-surface">
          {primaryLabel}
        </span>
        {isTransfer ? (
          <span className="truncate text-body-sm text-on-surface-variant">
            {(accountName ?? "Rekening") +
              " \u2192 " +
              (destinationAccountName ?? "Rekening") +
              " \u00b7 " +
              formatDate(transaction.transaction_at)}
          </span>
        ) : (
          <span className="truncate text-body-sm text-on-surface-variant">
            {metaParts.join(" \u00b7 ")}
          </span>
        )}
      </div>
      <span className="max-w-[42%] shrink-0 overflow-hidden text-ellipsis">
        <AmountText
          value={amountValue}
          tone={amountTone}
          size="sm"
          signed={!isTransfer}
        />
      </span>
    </li>
  );
}
