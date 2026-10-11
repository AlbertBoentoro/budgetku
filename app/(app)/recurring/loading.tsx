import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable skeleton: a section heading placeholder plus a few row skeletons
// that mirror the real recurring row layout (icon, name/meta, amount).
export function RecurringLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-4 w-20 rounded bg-muted" />
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="size-5 shrink-0 rounded-full bg-muted" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 w-40 rounded bg-muted" />
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
      <AppHeader title="Transaksi berulang" />
      <PageContainer>
        <div className="animate-pulse">
          <RecurringLoading />
        </div>
      </PageContainer>
    </>
  );
}
