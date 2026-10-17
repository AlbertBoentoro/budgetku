import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Icon } from "@/components/ui/icon";

// Mirrors the deleted app/protected/page.tsx pattern: the dynamic auth call
// (reads cookies) must run inside a <Suspense> boundary, otherwise the PPR
// step of `next build` fails because of cacheComponents in next.config.ts.
async function AuthGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/auth/login");
  }

  return <>{children}</>;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* Fixed Stitch shell header: wordmark + settings entry point.
          Pengaturan reaches /settings from here after leaving the bottom nav. */}
      <header className="fixed inset-x-0 top-0 z-40 mx-auto flex h-14 w-full max-w-md items-center justify-between gap-2 border-b border-outline-variant bg-surface/80 px-4 pt-safe backdrop-blur-xl">
        <Link
          href="/dashboard"
          className="text-title-md font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Budgetku
        </Link>
        <Link
          href="/settings"
          className="flex size-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Icon name="settings" size={22} aria-label="Pengaturan" />
        </Link>
      </header>
      <main className="flex-1 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <Suspense>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </main>
      {/* BottomNav reads usePathname (runtime-only). Wrapping it in Suspense
          lets dynamic routes (e.g. /accounts/[id]/edit) still prerender the
          shell; the rendered nav and its behavior are unchanged. */}
      <Suspense>
        <BottomNav />
      </Suspense>
    </div>
  );
}
