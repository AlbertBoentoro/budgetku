import { cn } from "@/lib/utils";

type AmountTone = "default" | "income" | "expense";
// "none" emits no font-size/weight class, so callers can supply a custom size
// (e.g. a Stitch type-scale key like `text-currency-body`) via `className`
// without a default `text-base` fighting it through tailwind-merge.
type AmountSize = "none" | "sm" | "md" | "lg" | "xl";

const toneClasses: Record<AmountTone, string> = {
  default: "text-foreground",
  income: "text-income",
  expense: "text-expense",
};

const sizeClasses: Record<AmountSize, string> = {
  none: "",
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-2xl font-semibold",
  xl: "text-4xl font-bold",
};

interface AmountTextProps {
  value: number;
  tone?: AmountTone;
  size?: AmountSize;
  // Defaults to IDR; overridable once the data/settings layer provides one.
  currency?: string;
  // When true, show an explicit +/- sign so income/expense meaning does not
  // rely on color alone (negatives already carry the native minus sign).
  signed?: boolean;
  className?: string;
}

export function AmountText({
  value,
  tone = "default",
  size = "md",
  currency = "IDR",
  signed = false,
  className,
}: AmountTextProps) {
  // Presentation only: Indonesian locale, no decimals (e.g. "Rp12.345.670").
  // The numeric `value` is never scaled or converted here.
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

  // Prefix "+" only for positive values when signed; the formatter already
  // renders a leading "-" for negatives, so expenses stay distinct without color.
  const display = signed && value > 0 ? `+${formatted}` : formatted;

  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums tracking-tight",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {display}
    </span>
  );
}
