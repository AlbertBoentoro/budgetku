import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        // Bottom padding clears the fixed BottomNav (nav height + safe area).
        "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
