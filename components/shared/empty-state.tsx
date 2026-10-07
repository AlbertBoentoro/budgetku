import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
