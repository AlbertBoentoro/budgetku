import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

// Account type -> Material Symbol glyph, local to the dashboard. The shared
// getAccountTypeMeta returns a lucide icon, but this screen renders Material
// Symbols, so we map here and keep getAccountTypeMeta(type).label for the
// Indonesian type label. Unknown/legacy types fall back to a wallet glyph.
const ACCOUNT_TYPE_GLYPH: Record<string, string> = {
  cash: "payments",
  bank: "account_balance",
  e_wallet: "account_balance_wallet",
  credit_card: "credit_card",
  savings: "savings",
  investment: "trending_up",
};

export function accountTypeGlyph(type: string): string {
  return ACCOUNT_TYPE_GLYPH[type] ?? "account_balance_wallet";
}

interface DashboardAccountCardProps {
  name: string;
  typeLabel: string;
  glyph: string;
  balance: number;
}

// Stitch horizontal-scroll account card. Presentational only: the balance is a
// real running balance computed on the server and passed in as a prop.
export function DashboardAccountCard({
  name,
  typeLabel,
  glyph,
  balance,
}: DashboardAccountCardProps) {
  return (
    <div className="flex min-w-[170px] shrink-0 flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={glyph} size={22} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-label-xs uppercase text-on-surface-variant">
          {typeLabel}
        </span>
        <span className="truncate text-title-md text-on-surface">{name}</span>
      </div>
      <AmountText value={balance} size="none" className="text-currency-body" />
    </div>
  );
}
