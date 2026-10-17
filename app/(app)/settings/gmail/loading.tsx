import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable skeleton: a connection panel placeholder plus a short list of row
// skeletons that roughly mirror the real draft/history row layout.
export function GmailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-3 w-52 rounded bg-muted" />
        <div className="h-11 w-full rounded-md bg-muted" />
      </div>
      <div className="h-4 w-28 rounded bg-muted" />
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="size-5 shrink-0 rounded-full bg-muted" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 w-44 rounded bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
            <div className="h-4 w-20 rounded bg-muted" />
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
