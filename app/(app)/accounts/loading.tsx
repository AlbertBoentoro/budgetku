import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable list skeleton: a header placeholder plus a few row skeletons that
// mirror the real list layout (icon, name/type, amount). No spinner-only view.
export function AccountsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-3">
        <div className="h-5 w-24 rounded bg-muted" />
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="size-5 shrink-0 rounded-full bg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
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
      <AppHeader title="Rekening" />
      <PageContainer>
        <div className="animate-pulse">
          <AccountsLoading />
        </div>
      </PageContainer>
    </>
  );
}
