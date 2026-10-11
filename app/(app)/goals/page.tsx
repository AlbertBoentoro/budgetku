import { Suspense } from "react";
import Link from "next/link";
import { Plus, Target } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  computeContributionTotals,
  computeGoalProgress,
  fetchGoals,
  resolveGoalStatus,
  type GoalView,
} from "@/lib/goals";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalList } from "@/components/finance/goal-list";
import { Button } from "@/components/ui/button";
import { GoalsLoading } from "@/app/(app)/goals/loading";

export default function GoalsPage() {
  return (
    <>
      <AppHeader title="Target tabungan" />
      <PageContainer>
        <Suspense fallback={<GoalsLoading />}>
          <GoalsContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function GoalsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the query strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <GoalsError message="Sesi berakhir. Silakan masuk kembali untuk melihat target tabungan." />
    );
  }

  const goals = await fetchGoals(supabase, user.id);

  // Empty — no goals yet.
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState
          icon={Target}
          title="Belum ada target tabungan"
          description="Buat target pertamamu untuk melacak progres menabung."
        />
        <Button asChild className="h-11">
          <Link href="/goals/new">
            <Plus aria-hidden />
            Tambah target
          </Link>
        </Button>
      </div>
    );
  }

  // Real saved totals per goal in a single query. On failure, degrade to an
  // incomplete notice (saved treated as 0) rather than crashing the page.
  let totals = new Map<string, number>();
  let totalsIncomplete = false;
  try {
    totals = await computeContributionTotals(
      supabase,
      user.id,
      goals.map((g) => g.id),
    );
  } catch {
    totalsIncomplete = true;
  }

  const views: GoalView[] = goals.map((goal) => {
    const saved = totals.get(goal.id) ?? 0;
    const progress = computeGoalProgress(Number(goal.target_amount), saved);
    return {
      ...goal,
      progress,
      group: resolveGoalStatus(goal.status, progress.isAchieved),
    };
  });

  const active = views.filter((v) => v.group === "active");
  const achieved = views.filter((v) => v.group === "achieved");
  const archived = views.filter((v) => v.group === "archived");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Semua target
        </h2>
        <Button asChild size="sm" className="h-9">
          <Link href="/goals/new">
            <Plus aria-hidden />
            Tambah target
          </Link>
        </Button>
      </div>

      {totalsIncomplete ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Sebagian data kontribusi gagal dimuat, jadi angka terkumpul mungkin
          belum lengkap. Muat ulang untuk mencoba lagi.
        </p>
      ) : null}

      <GoalList active={active} achieved={achieved} archived={archived} />
    </div>
  );
}

function GoalsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/goals">Muat ulang</Link>
      </Button>
    </div>
  );
}
