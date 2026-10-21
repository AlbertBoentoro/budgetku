import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable skeleton mirroring the real layout: an intro row, the summary card,
// a tab bar, and a few recurring card placeholders. Pure placeholders on Calm
// Ledger surface tokens so the loading state matches the final shapes.
export function RecurringLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
        <div className="h-11 w-32 rounded-md bg-muted" />
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-3 w-32 rounded bg-muted" />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1">
        <div className="h-11 rounded-lg bg-muted" />
        <div className="h-11 rounded-lg bg-surface-container" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-md shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="size-10 shrink-0 rounded-full bg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-28 rounded bg-muted" />
              </div>
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
            <div className="h-3 w-36 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Transaksi Berulang" />
      <PageContainer>
        <div className="animate-pulse">
          <RecurringLoading />
        </div>
      </PageContainer>
    </>
  );
}
