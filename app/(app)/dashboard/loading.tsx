import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Dashboard skeleton that mirrors the new Stitch layout so the fallback does
// not jump when data streams in: a net-balance card with three summary pills, a
// four-tile quick-actions row, a budget card, a horizontal account-card row, and
// a few recent-transaction rows. No spinner-only view, no visible copy (all
// aria-hidden). Uses the same Stitch surfaces as the real screen.
export function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {/* Net balance card: label + big balance + three summary pills. */}
      <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-3 w-28 rounded bg-surface-container" />
          <div className="size-6 rounded-full bg-surface-container" />
        </div>
        <div className="h-9 w-48 rounded bg-surface-container" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-2.5"
            >
              <div className="h-3 w-16 rounded bg-surface-container" />
              <div className="h-4 w-20 rounded bg-surface-container" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions: four tiles. */}
      <div className="grid grid-cols-4 gap-md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-sm"
          >
            <div className="size-11 rounded-full bg-surface-container" />
            <div className="h-3 w-12 rounded bg-surface-container" />
          </div>
        ))}
      </div>

      {/* Budget card: title + bar + a figure row. */}
      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 rounded bg-surface-container" />
          <div className="h-3 w-12 rounded bg-surface-container" />
        </div>
        <div className="h-3 w-56 rounded bg-surface-container" />
        <div className="h-2 w-full rounded-full bg-surface-container-low" />
        <div className="flex justify-between">
          <div className="h-3 w-20 rounded bg-surface-container" />
          <div className="h-3 w-24 rounded bg-surface-container" />
        </div>
      </div>

      {/* Accounts: a horizontal row of account-card placeholders. */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-40 rounded bg-surface-container" />
        <div className="-mx-1 flex gap-3 overflow-hidden px-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex min-w-[170px] shrink-0 flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm"
            >
              <div className="size-10 rounded-full bg-surface-container" />
              <div className="h-3 w-16 rounded bg-surface-container" />
              <div className="h-4 w-24 rounded bg-surface-container" />
              <div className="h-5 w-20 rounded bg-surface-container" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions: rows mirroring icon + label/meta + amount. */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-40 rounded bg-surface-container" />
        <ul className="flex flex-col divide-y divide-outline-variant rounded-xl bg-surface-container-lowest shadow-sm">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
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
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Beranda" />
      <PageContainer>
        <div className="animate-pulse">
          <DashboardLoading />
        </div>
      </PageContainer>
    </>
  );
}
