import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable goals skeleton: a header line and a few goal-row skeletons that
// mirror the real layout (icon, name, a progress bar placeholder).
export function GoalsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="h-9 w-32 rounded-md bg-muted" />
      </div>

      <ul className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-2xl border bg-card p-4"
          >
            <div className="size-10 shrink-0 rounded-full bg-muted" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-40 rounded bg-muted" />
              <div className="h-1.5 w-full rounded-full bg-muted" />
            </div>
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
      <AppHeader title="Target tabungan" />
      <PageContainer>
        <div className="animate-pulse">
          <GoalsLoading />
        </div>
      </PageContainer>
    </>
  );
}
