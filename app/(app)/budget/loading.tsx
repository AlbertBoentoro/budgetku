import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable budget skeleton mirroring the Stitch layout: a centered pill month
// switcher placeholder, a summary banner placeholder, and a few category-card
// skeletons.
export function BudgetLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex justify-center">
        <div className="h-11 w-44 rounded-full bg-surface-container" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 rounded bg-surface-container" />
            <div className="h-7 w-40 rounded bg-surface-container" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-3 w-20 rounded bg-surface-container" />
            <div className="h-5 w-24 rounded bg-surface-container" />
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-container" />
        <div className="h-4 w-36 rounded bg-surface-container" />
      </div>

      <ul className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-3.5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-full bg-surface-container" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-32 rounded bg-surface-container" />
                <div className="h-3 w-24 rounded bg-surface-container" />
              </div>
              <div className="h-5 w-20 rounded bg-surface-container" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-container" />
            <div className="h-3 w-40 rounded bg-surface-container" />
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
