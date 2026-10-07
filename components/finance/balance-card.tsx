import { cn } from "@/lib/utils";
import { AmountText } from "@/components/finance/amount-text";

interface BalanceCardProps {
  label?: string;
  balance: number;
  subtitle?: React.ReactNode;
  className?: string;
}

export function BalanceCard({
  label = "Total balance",
  balance,
  subtitle,
  className,
}: BalanceCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-card p-6 text-card-foreground shadow-soft",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <AmountText value={balance} size="xl" />
      {subtitle ? (
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  );
}
