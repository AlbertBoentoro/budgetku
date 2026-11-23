import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";
import type { BalanceAdjustmentRowView } from "@/lib/account-balance-adjustments";

// Match the regular transaction ledger: label, account and signed amount.
// Before/after balances and precise timestamp remain in the immutable audit
// record but do not clutter the transaction list.
export function BalanceAdjustmentLedgerRow({
  adjustment,
}: {
  adjustment: BalanceAdjustmentRowView;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name="edit" size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md text-on-surface">
          Penyesuaian Saldo
        </span>
        <span className="truncate text-body-sm text-on-surface-variant">
          {adjustment.accountName}
        </span>
      </span>
      <AmountText
        value={adjustment.delta}
        tone="default"
        size="none"
        signed
        className="text-body-md font-semibold"
      />
    </li>
  );
}
