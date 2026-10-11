import { Suspense } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  computeGoalProgress,
  fetchGoalWithContributions,
  formatGoalDate,
  getGoalIcon,
} from "@/lib/goals";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalProgress } from "@/components/finance/goal-progress";
import { GoalDetailActions } from "@/components/finance/goal-detail-actions";
import { GoalContributionHistory } from "@/components/finance/goal-contribution-history";
import { Button } from "@/components/ui/button";

interface GoalDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function GoalDetailPage({ params }: GoalDetailPageProps) {
  return (
    <>
      <AppHeader title="Target tabungan" />
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
  const Icon = getGoalIcon(goal.icon);
  const targetDate = formatGoalDate(goal.target_date);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {goal.name}
            </h1>
            {targetDate ? (
              <span className="text-sm text-muted-foreground">
                Target tanggal {targetDate}
              </span>
            ) : null}
          </div>
        </div>

        <GoalProgress progress={progress} size="md" />

        {goal.notes ? (
          <p className="text-sm text-muted-foreground">{goal.notes}</p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className="h-11 flex-1">
          <Link href={`/goals/${goal.id}/contribute`}>
            <Plus aria-hidden />
            Tambah kontribusi
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/goals/${goal.id}/edit`}>
            <Pencil aria-hidden />
            Ubah
          </Link>
        </Button>
      </div>

      <GoalDetailActions goalId={goal.id} status={goal.status} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Riwayat kontribusi
        </h2>
        {contributions.length === 0 ? (
          <EmptyState
            title="Belum ada kontribusi"
            description="Catat kontribusi pertama untuk mulai melacak progres."
          />
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

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 rounded-full bg-muted" />
          <div className="h-5 w-40 rounded bg-muted" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      <div className="h-11 w-full rounded-md bg-muted" />
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-2 px-4 py-3">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Target tidak ditemukan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/goals">Kembali ke target</Link>
      </Button>
    </div>
  );
}
