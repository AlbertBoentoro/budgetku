import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/layout/bottom-nav";

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
      <main className="flex-1 pt-[env(safe-area-inset-top)]">
        <Suspense>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
