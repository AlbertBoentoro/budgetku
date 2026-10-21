import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable skeleton: a connection card placeholder plus a short list of row
// skeletons that roughly mirror the real draft/history row layout, on the
// Stitch surface tokens so the fallback matches the loaded screen.
export function GmailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="size-10 shrink-0 rounded-full bg-surface-container" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-40 rounded bg-surface-container" />
            <div className="h-3 w-52 rounded bg-surface-container" />
          </div>
        </div>
        <div className="h-11 w-full rounded-lg bg-surface-container" />
      </div>
      <div className="h-4 w-28 rounded bg-surface-container" />
      <ul className="flex flex-col divide-y divide-outline-variant rounded-xl bg-surface-container-lowest shadow-sm">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="size-10 shrink-0 rounded-full bg-surface-container" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 w-44 rounded bg-surface-container" />
              <div className="h-3 w-28 rounded bg-surface-container" />
            </div>
            <div className="h-4 w-20 rounded bg-surface-container" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Impor dari Gmail" />
      <PageContainer>
        <div className="animate-pulse">
          <GmailLoading />
        </div>
      </PageContainer>
    </>
  );
}
