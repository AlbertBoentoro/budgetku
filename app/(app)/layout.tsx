import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { AppFrame } from "@/components/layout/app-frame";

// Mirrors the deleted app/protected/page.tsx pattern: the dynamic auth call
// (reads cookies) must run inside a <Suspense> boundary, otherwise the PPR
// step of `next build` fails because of cacheComponents in next.config.ts.
async function AuthGuard({ children }: { children: React.ReactNode }) {
  await connection();

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
    <Suspense>
      <AppFrame>
        <Suspense>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </AppFrame>
    </Suspense>
  );
}
