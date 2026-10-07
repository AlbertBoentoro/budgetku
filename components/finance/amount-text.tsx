import { cn } from "@/lib/utils";

type AmountTone = "default" | "income" | "expense";
type AmountSize = "sm" | "md" | "lg" | "xl";

const toneClasses: Record<AmountTone, string> = {
  default: "text-foreground",
  income: "text-income",
  expense: "text-expense",
};

const sizeClasses: Record<AmountSize, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-2xl font-semibold",
  xl: "text-4xl font-bold",
};

interface AmountTextProps {
  value: number;
  tone?: AmountTone;
  size?: AmountSize;
  // 'USD' is a placeholder currency until the data/settings layer provides one.
  currency?: string;
  className?: string;
}

export function AmountText({
  value,
  tone = "default",
  size = "md",
  currency = "USD",
  className,
}: AmountTextProps) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);

  return (
    <span
      className={cn(
        "tabular-nums tracking-tight",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {formatted}
    </span>
  );
}
