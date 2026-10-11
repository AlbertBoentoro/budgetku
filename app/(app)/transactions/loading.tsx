import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable ledger skeleton: a short filter placeholder plus a few row
// skeletons that mirror the real row layout (icon, label/metadata, amount).
export function TransactionsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-11 w-full rounded-md bg-muted" />
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="size-5 shrink-0 rounded-full bg-muted" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 w-36 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
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
      <AppHeader title="Transaksi" />
      <PageContainer>
        <div className="animate-pulse">
          <TransactionsLoading />
        </div>
      </PageContainer>
    </>
  );
}
