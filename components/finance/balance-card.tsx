import { cn } from "@/lib/utils";
import { AmountText } from "@/components/finance/amount-text";

interface BalanceCardProps {
  label?: string;
  balance: number;
  subtitle?: React.ReactNode;
  className?: string;
}

export function BalanceCard({
  label = "Saldo",
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
      {/* Step the total down on narrow screens so a long IDR value (e.g.
          "Rp 999.999.999", which includes a narrow no-break space after Rp)
          stays inside the card's p-6 content area, then grow to text-4xl when
          there is room. whitespace-nowrap (in AmountText) keeps sign/Rp/digits
          together; nothing is truncated or hidden. Still the largest amount on
          screen, so the total stays the focal point. */}
      <AmountText
        value={balance}
        size="xl"
        className="text-3xl min-[360px]:text-4xl"
      />
      {subtitle ? (
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  );
}
