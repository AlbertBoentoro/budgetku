import { AppBackLink } from "@/components/layout/app-back-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable skeleton mirroring the settings layout (profile card, feature list,
// Keluar card). Also the Suspense fallback in page.tsx.
export function SettingsLoading() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Memuat pengaturan...</span>

      <div className="flex flex-col gap-3" aria-hidden>
        <div className="mx-1 h-4 w-12 rounded bg-surface-container" />
        <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="size-12 shrink-0 rounded-full bg-surface-container" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-5 w-3/4 max-w-56 rounded bg-surface-container" />
            <div className="h-3 w-1/2 max-w-40 rounded bg-surface-container" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3" aria-hidden>
        <div className="mx-1 h-4 w-12 rounded bg-surface-container" />
        <ul className="flex flex-col divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
              <div className="size-10 shrink-0 rounded-full bg-surface-container" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="h-4 w-1/2 max-w-40 rounded bg-surface-container" />
                <div className="h-3 w-5/6 max-w-64 rounded bg-surface-container" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="flex min-h-[56px] items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm"
        aria-hidden
      >
        <div className="size-10 shrink-0 rounded-full bg-surface-container" />
        <div className="h-4 w-16 rounded bg-surface-container" />
      </div>
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader
        title="Pengaturan"
        titleAction={
          <AppBackLink href="/dashboard" label="Kembali ke Beranda" />
        }
      />
      <PageContainer className="pb-6">
        <div className="animate-pulse motion-reduce:animate-none">
          <SettingsLoading />
        </div>
      </PageContainer>
    </>
  );
}
