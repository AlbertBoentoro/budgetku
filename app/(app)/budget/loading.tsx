import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable budget skeleton: month switcher placeholder, a summary card
// placeholder, and a few item-row skeletons that mirror the real layout.
export function BudgetLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <div className="size-11 shrink-0 rounded-md bg-muted" />
        <div className="h-11 w-40 rounded-md bg-muted" />
        <div className="size-11 shrink-0 rounded-md bg-muted" />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-5 w-24 rounded bg-muted" />
        </div>
      </div>

      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-2 px-4 py-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-1.5 w-full rounded-full bg-muted" />
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
      <AppHeader title="Anggaran" />
      <PageContainer>
        <div className="animate-pulse">
          <BudgetLoading />
        </div>
      </PageContainer>
    </>
  );
}
