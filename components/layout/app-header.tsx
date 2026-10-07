import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  title,
  subtitle,
  action,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-4 px-4 pt-[env(safe-area-inset-top)]",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 pt-4">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-4">{action}</div> : null}
    </header>
  );
}
