import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  titleAction?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  title,
  subtitle,
  titleAction,
  action,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "mx-auto flex w-full max-w-3xl items-start justify-between gap-4 px-4",
        // Every detail/settings page supplies AppBackLink as titleAction.
        // Keep the back button and title accessible as the document scrolls.
        // Use the document scroller and safe-area inset, not a nested
        // overflow container that would break sticky on iOS PWA.
        titleAction &&
          "sticky top-[env(safe-area-inset-top)] z-30 items-center border-b border-outline-variant bg-surface py-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {titleAction}
          <h1 className="min-w-0 text-headline-lg text-on-surface">{title}</h1>
        </div>
        {subtitle ? (
          <p className="text-body-sm text-on-surface-variant">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
