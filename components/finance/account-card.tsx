import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { AmountText } from "@/components/finance/amount-text";

type AccountAccent =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "slate";

// Account cards are the ONLY surfaces that use the colorful accent tokens,
// and the accent now colors just the account icon (not the whole card).
const accentIconClasses: Record<AccountAccent, string> = {
  blue: "text-account-blue",
  violet: "text-account-violet",
  emerald: "text-account-emerald",
  amber: "text-account-amber",
  rose: "text-account-rose",
  slate: "text-account-slate",
};

interface AccountCardProps {
  name: string;
  balance: number;
  accent: AccountAccent;
  icon?: LucideIcon;
  className?: string;
}

export function AccountCard({
  name,
  balance,
  accent,
  icon: Icon,
  className,
}: AccountCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-2xl border bg-card p-4 text-card-foreground shadow-soft",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon className={cn("size-5", accentIconClasses[accent])} aria-hidden />
        ) : null}
        <span className="text-sm font-medium text-card-foreground">{name}</span>
      </div>
      {/* Single column at narrow widths has room for the large (text-2xl)
          amount; the two-column grid (from 375px) makes each card narrow,
          so step the amount down there and back up when the cards widen,
          keeping long/negative IDR (e.g. -Rp999.999.999) on one line without
          clipping. The total BalanceCard stays the xl focal point. */}
      <AmountText
        value={balance}
        size="lg"
        className="min-[375px]:text-base min-[430px]:text-xl"
      />
    </div>
  );
}
