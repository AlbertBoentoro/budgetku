import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Header back action shared by the page and the route loading UI, so the header
// does not jump when the content streams in. Reports is not a bottom-nav
// destination, so this is the clear way back to the dashboard (the single entry
// point lives on /dashboard).
export function ReportsBackAction() {
  return (
    <Button asChild variant="ghost" size="sm" className="h-11">
      <Link href="/dashboard">
        <Icon name="arrow_back" size={18} />
        Beranda
      </Link>
    </Button>
  );
}

// Reusable reports skeleton mirroring the real layout: month switcher pill, the
// summary card, then three titled section cards. Decorative only (aria-hidden,
// no copy).
export function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="mx-auto h-14 w-64 max-w-full rounded-full bg-surface-container-lowest shadow-sm" />

      <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="h-3 w-32 rounded bg-surface-container" />
        <div className="h-8 w-48 max-w-full rounded bg-surface-container" />
        <div className="h-20 rounded-lg bg-surface-container-low" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="h-5 w-44 rounded bg-surface-container" />
          <div className="h-56 rounded-xl bg-surface-container-lowest shadow-sm" />
        </div>
      ))}
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Laporan" action={<ReportsBackAction />} />
      <PageContainer>
        <div className="animate-pulse motion-reduce:animate-none">
          <ReportsLoading />
        </div>
      </PageContainer>
    </>
  );
}
