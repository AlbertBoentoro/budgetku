import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import { SettingsLoading } from "@/app/(app)/settings/loading";

export default function SettingsPage() {
  return (
    <>
      <AppHeader title="Pengaturan" />
      <PageContainer>
        <Suspense fallback={<SettingsLoading />}>
          <SettingsContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function SettingsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the page strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sesi berakhir. Silakan masuk kembali.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        <li>
          {/* Entry point to manage recurring templates (created via the
              Transaksi berulang checkbox on Tambah transaksi). */}
          <Link
            href="/recurring"
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Repeat className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">Transaksi berulang</span>
              <span className="text-sm text-muted-foreground">
                Kelola jadwal pemasukan dan pengeluaran berulang.
              </span>
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </li>

        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-medium">Tema</span>
          <ThemeSwitcher />
        </li>
      </ul>

      <LogoutButton />
    </div>
  );
}
