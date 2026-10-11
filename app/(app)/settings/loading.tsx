import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";

// Reusable skeleton mirroring the settings list (icon, label/meta rows).
export function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {Array.from({ length: 2 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="size-5 shrink-0 rounded-full bg-muted" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-48 rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
      <div className="h-9 w-24 rounded bg-muted" />
    </div>
  );
}

// Route-level loading UI shown while the server component streams.
export default function Loading() {
  return (
    <>
      <AppHeader title="Pengaturan" />
      <PageContainer>
        <div className="animate-pulse">
          <SettingsLoading />
        </div>
      </PageContainer>
    </>
  );
}
