import { AppBackLink } from "@/components/layout/app-back-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable reports skeleton mirroring the real layout: month switcher pill, the
// summary card, then three titled section cards. Decorative only (aria-hidden,
// no copy).
export function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="mx-auto h-14 w-64 max-w-full rounded-full bg-surface-container-lowest shadow-sm" />

      <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
        <div className="h-3 w-32 rounded bg-surface-container" />
        <div className="h-8 w-48 max-w-full rounded bg-surface-container" />
        <div className="h-20 rounded-lg bg-surface-container-low" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="h-5 w-44 rounded bg-surface-container" />
          <div className="h-56 rounded-xl border border-outline-variant bg-surface-container-lowest" />
        </div>
      ))}
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader
        title="Laporan"
        titleAction={
          <AppBackLink href="/settings" label="Kembali ke Pengaturan" />
        }
      />
      <PageContainer>
        <div className="animate-pulse motion-reduce:animate-none">
          <ReportsLoading />
        </div>
      </PageContainer>
    </>
  );
}
