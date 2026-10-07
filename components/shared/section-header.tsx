import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
