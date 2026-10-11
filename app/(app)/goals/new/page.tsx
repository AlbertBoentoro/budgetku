import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { fetchActiveAccounts } from "@/lib/transactions";
import { createGoal, type GoalFormInput } from "@/app/(app)/goals/actions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { GoalForm } from "@/components/finance/goal-form";
import { Button } from "@/components/ui/button";

export default function NewGoalPage() {
  return (
    <>
      <AppHeader title="Tambah target" />
      <PageContainer>
        <Suspense fallback={<NewGoalSkeleton />}>
          <NewGoalContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function NewGoalContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SessionExpiredState />;
  }

  const accounts = await fetchActiveAccounts(supabase, user.id);

  // Bound server action: createGoal sets user_id server-side; the client only
  // sends the form input.
  async function action(input: GoalFormInput) {
    "use server";
    return createGoal(input);
  }

  return <GoalForm mode="create" action={action} accounts={accounts} />;
}

function NewGoalSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-11 w-full rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}

function SessionExpiredState() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">
        Sesi berakhir. Silakan masuk kembali untuk membuat target.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/goals">Kembali ke target</Link>
      </Button>
    </div>
  );
}
