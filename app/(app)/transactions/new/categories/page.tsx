import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { fetchUsableCategories } from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { CategoryPicker } from "@/components/finance/transaction-category-picker";

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default function TransactionCategoriesPage({ searchParams }: PageProps) {
  return (
    <>
      <AppHeader
        title="Pilih kategori"
        titleAction={<AppBackLink href="/transactions/new?restore=back" label="Kembali ke Catat" />}
      />
      <PageContainer className="pb-8">
        <Suspense fallback={<p className="text-body-sm text-on-surface-variant">Memuat kategori…</p>}>
          <CategoryPickerContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function CategoryPickerContent({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const type = params.type === "income" ? "income" : "expense";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (
    <p role="alert">Sesi berakhir. <Link href="/auth/login" className="underline">Masuk lagi</Link>.</p>
  );
  const categories = await fetchUsableCategories(supabase, user.id, type);
  return <CategoryPicker direction={type} categories={categories} />;
}
