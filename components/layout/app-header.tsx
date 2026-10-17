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
        "flex items-start justify-between gap-4 px-4",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h1 className="text-headline-lg text-on-surface">{title}</h1>
        {subtitle ? (
          <p className="text-body-sm text-on-surface-variant">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
