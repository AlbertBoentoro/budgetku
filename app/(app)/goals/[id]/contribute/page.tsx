import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  addContribution,
  type ContributionFormInput,
} from "@/app/(app)/goals/actions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { ContributionForm } from "@/components/finance/contribution-form";
import { Button } from "@/components/ui/button";

interface ContributePageProps {
  params: Promise<{ id: string }>;
}

export default function ContributePage({ params }: ContributePageProps) {
  return (
    <>
      <AppHeader title="Tambah kontribusi" />
      <PageContainer>
        <Suspense fallback={<ContributeSkeleton />}>
          <ContributeContent params={params} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function ContributeContent({ params }: ContributePageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <NotFoundState />;
  }

  // Confirm the goal belongs to the user before offering the form (scope by
  // id AND user_id; another user's id returns no row).
  const { data, error } = await supabase
    .from("financial_goals")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return <NotFoundState />;
  }

  // Bound server action: the goal id is fixed server-side; the client only
  // sends the contribution input. addContribution re-checks ownership.
  async function action(input: ContributionFormInput) {
    "use server";
    return addContribution(id, input);
  }

  return <ContributionForm goalId={id} action={action} />;
}

function ContributeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-11 w-full rounded-md bg-muted" />
        </div>
      ))}
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
