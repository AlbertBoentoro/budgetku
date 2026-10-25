import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-50 dark:text-slate-900 sm:px-6 sm:py-12">
      <div className="w-full max-w-sm">
        <p className="mb-5 text-center text-lg font-semibold tracking-tight">
          Budgetku
        </p>
        {children}
      </div>
    </main>
  );
}

export function AuthCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-xl border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-200 dark:bg-white dark:text-slate-900",
        className,
      )}
    >
      {children}
    </Card>
  );
}
