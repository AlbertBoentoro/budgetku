import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable goals skeleton that mirrors the new Stitch list: a banner block, a
// segmented chip row, and a few goal-card placeholders. Purely decorative, so
// the whole tree is aria-hidden.
export function GoalsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="h-3 w-40 rounded bg-surface-container" />
        <div className="h-8 w-48 rounded bg-surface-container" />
        <div className="h-2 w-full rounded-full bg-surface-container" />
      </div>

      <div className="h-11 w-full rounded-xl bg-surface-container" />

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container-low p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-11 rounded-lg bg-surface-container" />
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-md shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-full bg-surface-container" />
              <div className="h-4 w-32 rounded bg-surface-container" />
            </div>
            <div className="h-5 w-40 rounded bg-surface-container" />
            <div className="h-2 w-full rounded-full bg-surface-container" />
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
      <AppHeader title="Target Tabungan" />
      <PageContainer>
        <div className="animate-pulse">
          <GoalsLoading />
        </div>
      </PageContainer>
    </>
  );
}
