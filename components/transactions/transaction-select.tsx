import type { ComponentProps } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

// Transaction forms use the same native select behavior, but reserve explicit
// space for the chevron across iOS, Android and desktop browsers.
const selectClassName =
  "flex h-11 w-full appearance-none rounded-md border border-input bg-transparent py-1 pl-3 pr-12 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function TransactionSelect({
  children,
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <div className="relative min-w-0 w-full">
      <select {...props} className={cn(selectClassName, className)}>
        {children}
      </select>
      <Icon
        name="expand_more"
        size={20}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
      />
    </div>
  );
}
