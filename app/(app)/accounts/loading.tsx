import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Accounts skeleton that mirrors the Stitch layout so the fallback does not
// jump when data streams in: a summary card (label + big total + button) and a
// couple of grouped section cards (header + rows). No spinner-only view, all
// aria-hidden. Uses the same Stitch surfaces as the real screen.
export function AccountsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {/* Summary card: label + big total + subline + button. */}
      <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-28 rounded bg-surface-container" />
          <div className="h-10 w-48 rounded bg-surface-container" />
          <div className="h-3 w-24 rounded bg-surface-container" />
        </div>
        <div className="h-11 w-full rounded-md bg-surface-container" />
      </div>

      {/* Two grouped section cards: header + a couple of rows each. */}
      {Array.from({ length: 2 }).map((_, s) => (
        <div
          key={s}
          className="flex flex-col rounded-xl bg-surface-container-lowest shadow-sm"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="size-9 shrink-0 rounded-full bg-surface-container" />
            <div className="h-4 w-28 flex-1 rounded bg-surface-container" />
            <div className="h-4 w-20 rounded bg-surface-container" />
          </div>
          <ul className="flex flex-col divide-y divide-outline-variant border-t border-outline-variant">
            {Array.from({ length: 2 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="size-10 shrink-0 rounded-full bg-surface-container" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="h-4 w-32 rounded bg-surface-container" />
                  <div className="h-3 w-20 rounded bg-surface-container" />
                </div>
                <div className="h-4 w-20 rounded bg-surface-container" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Rekening" />
      <PageContainer>
        <div className="animate-pulse">
          <AccountsLoading />
        </div>
      </PageContainer>
    </>
  );
}
