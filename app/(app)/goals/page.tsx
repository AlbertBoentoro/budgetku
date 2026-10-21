import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  computeContributionTotals,
  computeGoalProgress,
  fetchGoals,
  formatGoalDate,
  getGoalGlyph,
  resolveGoalStatus,
} from "@/lib/goals";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import {
  GoalOverview,
  type GoalAggregate,
} from "@/components/finance/goal-overview";
import type { GoalCardView } from "@/components/finance/goal-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { GoalsLoading } from "@/app/(app)/goals/loading";

export default function GoalsPage() {
  return (
    <>
      <AppHeader
        title="Target Tabungan"
        action={
          // Goals is reached from Anggaran (not the bottom nav), so offer a
          // clear way back to Budget.
          <Button asChild variant="ghost" size="sm" className="h-11">
            <Link href="/budget">
              <Icon name="arrow_back" size={18} />
              Anggaran
            </Link>
          </Button>
        }
      />
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
    return <GoalsEmpty />;
  }

  // Resolve linked account names once (user-scoped read, anon key, RLS backstop,
  // no archived filter so a later-archived linked account still resolves). A
  // failed read simply leaves account names blank — never crashes the list.
  const accountNames = new Map<string, string>();
  {
    const { data: accountRows } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", user.id);
    for (const row of accountRows ?? []) {
      accountNames.set(row.id, row.name);
    }
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

  const views = goals.map((goal) => {
    const saved = totals.get(goal.id) ?? 0;
    const progress = computeGoalProgress(Number(goal.target_amount), saved);
    const group = resolveGoalStatus(goal.status, progress.isAchieved);
    const view: GoalCardView = {
      id: goal.id,
      name: goal.name,
      glyph: getGoalGlyph(goal.icon),
      accountName: goal.account_id
        ? (accountNames.get(goal.account_id) ?? null)
        : null,
      targetDate: formatGoalDate(goal.target_date),
      group,
      progress,
    };
    return view;
  });

  const active = views.filter((v) => v.group === "active");
  const achieved = views.filter((v) => v.group === "achieved");
  const archived = views.filter((v) => v.group === "archived");

  // Aggregate over the ACTIVE goals only: real sums, divide-by-zero guarded.
  let savedActive = 0;
  let targetActive = 0;
  for (const v of active) {
    if (Number.isFinite(v.progress.saved)) savedActive += v.progress.saved;
    if (Number.isFinite(v.progress.target)) targetActive += v.progress.target;
  }
  const aggregate: GoalAggregate = {
    savedActive,
    targetActive,
    barPercent:
      targetActive > 0
        ? Math.max(0, Math.min(100, (savedActive / targetActive) * 100))
        : 0,
    activeCount: active.length,
  };

  return (
    <div className="flex flex-col gap-6">
      {totalsIncomplete ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-destructive"
        >
          Sebagian data kontribusi gagal dimuat, jadi angka terkumpul mungkin
          belum lengkap. Muat ulang untuk mencoba lagi.
        </p>
      ) : null}

      <GoalOverview
        aggregate={aggregate}
        active={active}
        achieved={achieved}
        archived={archived}
      />
    </div>
  );
}

// Honest empty state: only shown when the user truly has zero goals.
function GoalsEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-container-lowest p-lg text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name="savings" size={28} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-title-md text-on-surface">
          Belum ada target tabungan
        </p>
        <p className="max-w-xs text-body-sm text-on-surface-variant">
          Buat target pertamamu untuk melacak progres menabung.
        </p>
      </div>
      <Button asChild className="h-11">
        <Link href="/goals/new">
          <Icon name="add" size={20} />
          Tambah target
        </Link>
      </Button>
    </div>
  );
}

function GoalsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/goals">Muat ulang</Link>
      </Button>
    </div>
  );
}
