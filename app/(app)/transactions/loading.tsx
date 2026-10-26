import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Ledger skeleton mirroring the real screen: a search + chip bar, the month
// summary pill, and a couple of date-section cards (icon circle + two text
// lines + trailing amount) so the fallback reads as the final layout.
export function TransactionsLoading() {
  return (
    <>
      <p role="status" className="sr-only">
        Memuat transaksi
      </p>
      <div className="flex flex-col gap-6" aria-hidden="true">
        <div className="flex flex-col gap-3">
          <div className="h-11 w-full rounded-full bg-surface-container" />
          <div className="flex gap-2">
            <div className="h-11 w-20 rounded-full bg-surface-container" />
            <div className="h-11 w-28 rounded-full bg-surface-container" />
            <div className="h-11 w-24 rounded-full bg-surface-container" />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="h-3 w-32 rounded bg-surface-container" />
          <div className="grid grid-cols-1 gap-2 min-[448px]:grid-cols-2">
            <div className="h-16 rounded-lg bg-surface-container-low" />
            <div className="h-16 rounded-lg bg-surface-container-low" />
          </div>
        </div>

        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-space-xs">
              <div className="h-3 w-40 rounded bg-surface-container" />
              <div className="h-3 w-20 rounded bg-surface-container" />
            </div>
            <ul className="flex flex-col divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-space-md py-3">
                  <div className="size-10 shrink-0 rounded-full bg-surface-container" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="h-4 w-36 rounded bg-surface-container" />
                    <div className="h-3 w-24 rounded bg-surface-container" />
                  </div>
                  <div className="h-4 w-20 rounded bg-surface-container" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Transaksi" />
      <PageContainer>
        <div className="animate-pulse">
          <TransactionsLoading />
        </div>
      </PageContainer>
    </>
  );
}
