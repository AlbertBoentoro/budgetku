import { Suspense } from "react";
import { redirect } from "next/navigation";

import { PasskeyUnlock } from "@/components/auth/passkey-unlock";
import { createClient } from "@/lib/supabase/server";

type PasskeyPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default function PasskeyPage({ searchParams }: PasskeyPageProps) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-5 text-body-sm text-on-surface-variant"
        >
          Memuat verifikasi...
        </main>
      }
    >
      <PasskeyContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PasskeyContent({ searchParams }: PasskeyPageProps) {
  const [{ data }, params] = await Promise.all([
    createClient().then((client) => client.auth.getUser()),
    searchParams,
  ]);

  if (!data.user) redirect("/auth/login");

  const nextPath =
    typeof params.next === "string" &&
    /^\/(?![\\/])/.test(params.next) &&
    !params.next.includes("\\")
      ? params.next
      : "/dashboard";

  return <PasskeyUnlock nextPath={nextPath} />;
}
