import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  computeGoalProgress,
  fetchGoalWithContributions,
  formatGoalDate,
  getGoalGlyph,
  resolveGoalStatus,
  type GoalStatus,
} from "@/lib/goals";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AmountText } from "@/components/finance/amount-text";
import { GoalProgress } from "@/components/finance/goal-progress";
import { GoalDetailActions } from "@/components/finance/goal-detail-actions";
import { GoalContributionHistory } from "@/components/finance/goal-contribution-history";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface GoalDetailPageProps {
  params: Promise<{ id: string }>;
}

// Status chip copy keyed by the resolved grouping bucket (meaning lives in the
// label, never color alone).
const STATUS_CHIP: Record<GoalStatus, string> = {
  active: "Target Aktif",
  achieved: "Target Tercapai",
  archived: "Target Diarsipkan",
};

// Whole months from today until the target date, only when the date exists and
// is in the future. Returns null otherwise (no projection, no fabrication).
function monthsUntil(targetDate: string | null): number | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  if (target.getTime() <= now.getTime()) return null;
  let months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  if (target.getDate() < now.getDate()) months -= 1;
  return months > 0 ? months : null;
}

export default function GoalDetailPage({ params }: GoalDetailPageProps) {
  return (
    <>
      <AppHeader
        title="Detail Target"
        action={
          <Button asChild variant="ghost" size="sm" className="h-11">
            <Link href="/goals">
              <Icon name="arrow_back" size={18} />
              Target
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <Suspense fallback={<DetailSkeleton />}>
          <GoalDetailContent params={params} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function GoalDetailContent({ params }: GoalDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <NotFoundState />;
  }

  const { goal, contributions } = await fetchGoalWithContributions(
    supabase,
    user.id,
    id,
  );

  if (!goal) {
    return <NotFoundState />;
  }

  // Saved total straight from the fetched contributions (same user-scoped set),
  // coercing and skipping non-finite rows like the aggregation helper.
  let saved = 0;
  for (const c of contributions) {
    const amt = Number(c.amount);
    if (Number.isFinite(amt)) saved += amt;
  }

  const progress = computeGoalProgress(Number(goal.target_amount), saved);
  const group = resolveGoalStatus(goal.status, progress.isAchieved);
  const glyph = getGoalGlyph(goal.icon);
  const targetDate = formatGoalDate(goal.target_date);
  const months = monthsUntil(goal.target_date);
  const pct = Math.floor(progress.barPercent);

  // Resolve the linked account name (user-scoped single read, RLS backstop; no
  // archived filter so a later-archived linked account still resolves).
  let accountName: string | null = null;
  if (goal.account_id) {
    const { data: accountRow } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", goal.account_id)
      .eq("user_id", user.id)
      .maybeSingle();
    accountName = accountRow?.name ?? null;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status chip + more-menu. */}
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-surface-container px-3 py-1 text-label-md font-medium text-on-surface-variant">
          {STATUS_CHIP[group]}
        </span>
        <GoalDetailActions
          goalId={goal.id}
          status={goal.status}
          name={goal.name}
        />
      </div>

      {/* Overview card. */}
      <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
            <Icon name={glyph} size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate text-title-md text-on-surface">
              {goal.name}
            </h2>
            {goal.notes ? (
              <p className="text-body-sm text-on-surface-variant">
                {goal.notes}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-label-xs uppercase text-on-surface-variant">
            Terkumpul Saat Ini
          </span>
          <AmountText
            value={saved}
            size="none"
            className="text-display-lg-mobile text-on-surface"
          />
          <span className="text-body-sm text-on-surface-variant">
            {pct}% tercapai dari target{" "}
            <AmountText
              value={progress.target}
              size="none"
              className="text-body-sm"
            />
          </span>
        </div>

        <GoalProgress progress={progress} size="lg" />
      </section>

      {/* Metrics grid: only data-backed values (no Setoran Rutin, no Est.). */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-outline-variant shadow-sm">
        <Metric label="Sisa Target">
          <AmountText
            value={progress.remaining}
            size="none"
            className="text-currency-body text-on-surface"
          />
        </Metric>
        <Metric label="Target Waktu">
          <span className="text-body-md text-on-surface">
            {targetDate ?? "-"}
          </span>
          {months != null ? (
            <span className="text-body-sm text-on-surface-variant">
              {months} bulan lagi
            </span>
          ) : null}
        </Metric>
        <Metric label="Akun Simpanan" className="col-span-2">
          <span className="text-body-md text-on-surface">
            {accountName ?? "-"}
          </span>
        </Metric>
      </section>

      {/* Primary actions. Tarik Dana is intentionally omitted (not built). */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className="h-11 flex-1">
          <Link href={`/goals/${goal.id}/contribute`}>
            <Icon name="add" size={20} />
            Tambah Kontribusi
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/goals/${goal.id}/edit`}>
            <Icon name="edit" size={18} />
            Ubah Target
          </Link>
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-title-md text-on-surface">Riwayat Kontribusi</h2>
        {contributions.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-lowest p-lg text-center shadow-sm">
            <p className="text-title-md text-on-surface">Belum ada kontribusi</p>
            <p className="max-w-xs text-body-sm text-on-surface-variant">
              Catat kontribusi pertama untuk mulai melacak progres.
            </p>
          </div>
        ) : (
          <GoalContributionHistory
            goalId={goal.id}
            contributions={contributions}
          />
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 bg-surface-container-low p-md ${className ?? ""}`}
    >
      <span className="text-label-xs uppercase text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <div className="h-7 w-28 rounded-full bg-surface-container" />
        <div className="size-11 rounded-full bg-surface-container" />
      </div>
      <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 rounded-full bg-surface-container" />
          <div className="h-5 w-40 rounded bg-surface-container" />
        </div>
        <div className="h-8 w-48 rounded bg-surface-container" />
        <div className="h-2 w-full rounded-full bg-surface-container" />
      </div>
      <div className="h-11 w-full rounded-xl bg-surface-container" />
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="max-w-xs text-body-sm text-on-surface-variant">
        Target tidak ditemukan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/goals">Kembali ke target</Link>
      </Button>
    </div>
  );
}
