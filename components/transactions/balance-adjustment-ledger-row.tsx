import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";
import type { BalanceAdjustmentRowView } from "@/lib/account-balance-adjustments";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const wibTime = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function BalanceAdjustmentLedgerRow({
  adjustment,
}: {
  adjustment: BalanceAdjustmentRowView;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name="edit" size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-body-md font-medium text-on-surface">
            Penyesuaian Saldo
          </span>
          <AmountText
            value={adjustment.delta}
            size="none"
            tone="default"
            signed
            className="shrink-0 text-body-md font-semibold"
          />
        </div>
        <span className="text-body-sm text-on-surface-variant">
          {adjustment.accountName} · {wibTime.format(new Date(adjustment.transaction_at))} WIB
        </span>
        <span className="text-body-sm text-on-surface-variant">
          Sebelum {money.format(adjustment.balanceBefore)} → Sesudah {money.format(adjustment.balanceAfter)}
        </span>
        <span className="text-label-xs text-on-surface-variant">
          Koreksi saldo · bukan pemasukan atau pengeluaran
        </span>
      </div>
    </li>
  );
}
