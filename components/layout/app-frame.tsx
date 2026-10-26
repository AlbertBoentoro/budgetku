"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Icon } from "@/components/ui/icon";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSettingsPage =
    pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {isSettingsPage ? null : (
        <header className="fixed inset-x-0 top-0 z-40 mx-auto flex h-14 w-full max-w-md items-center justify-between gap-2 border-b border-outline-variant bg-surface/80 px-4 pt-safe backdrop-blur-xl">
          <Link
            href="/dashboard"
            className="text-title-md font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Budgetku
          </Link>
          <Link
            href="/settings"
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Icon name="settings" size={22} aria-label="Pengaturan" />
          </Link>
        </header>
      )}

      <main
        className={
          isSettingsPage
            ? "flex-1 pt-[calc(0.5rem+env(safe-area-inset-top))]"
            : "flex-1 pt-[calc(3.5rem+env(safe-area-inset-top))]"
        }
      >
        {children}
      </main>

      {isSettingsPage ? null : <BottomNav />}
    </div>
  );
}
