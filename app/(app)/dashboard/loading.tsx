import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Dashboard skeleton that mirrors the real layout so the fallback does not jump
// when data streams in: a tall balance placeholder, a two-figure month row, a
// 2-up account-card grid, and a few recent-transaction rows. No spinner-only
// view, no visible copy (all aria-hidden).
export function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {/* Balance card: label bar + a large balance bar (the focal number). */}
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-9 w-48 rounded bg-muted" />
      </div>

      {/* Month summary: two stacked figures (income / expense). */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-soft"
            >
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-6 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Accounts: a 2-up grid of account-card placeholders. */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-20 rounded bg-muted" />
        <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-6 rounded-2xl border bg-card p-4 shadow-soft"
            >
              <div className="flex items-center gap-2">
                <div className="size-5 shrink-0 rounded-full bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
              </div>
              <div className="h-6 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions: rows mirroring icon + label/meta + amount. */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-36 rounded bg-muted" />
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {Array.from({ length: 4 }).map((_, i) => (
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
