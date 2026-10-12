import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable reports skeleton: month switcher placeholder, a top-line summary
// placeholder, and three chart-card placeholders mirroring the real layout.
export function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <div className="size-11 shrink-0 rounded-md bg-muted" />
        <div className="h-11 w-40 rounded-md bg-muted" />
        <div className="size-11 shrink-0 rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl border bg-card" />
        <div className="h-20 rounded-2xl border bg-card" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-48 rounded-2xl border bg-card" />
        </div>
      ))}
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Laporan" />
      <PageContainer>
        <div className="animate-pulse">
          <ReportsLoading />
        </div>
      </PageContainer>
    </>
  );
}
