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

// Account cards are the ONLY surfaces that use colorful accent tokens.
const accentClasses: Record<AccountAccent, string> = {
  blue: "bg-account-blue text-account-blue-foreground",
  violet: "bg-account-violet text-account-violet-foreground",
  emerald: "bg-account-emerald text-account-emerald-foreground",
  amber: "bg-account-amber text-account-amber-foreground",
  rose: "bg-account-rose text-account-rose-foreground",
  slate: "bg-account-slate text-account-slate-foreground",
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
        "flex flex-col gap-6 rounded-2xl p-4",
        accentClasses[accent],
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-5" aria-hidden /> : null}
        <span className="text-sm font-medium opacity-90">{name}</span>
      </div>
      {/* Inherit the card's foreground color so the amount matches the accent. */}
      <AmountText value={balance} size="lg" className="text-current" />
    </div>
  );
}
