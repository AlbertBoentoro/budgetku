import Link from "next/link";
import { notFound } from "next/navigation";

import { isPublicTestingDemoAllowed } from "@/lib/auth/public-testing-demo";
import { DEMO_EXPENSE_CATEGORIES } from "@/lib/testing/demo-budgetku-data";
import { BudgetItemForm, type BudgetItemFormInitialValues } from "@/components/finance/budget-item-form";
import type { ActionResult, BudgetItemFormInput } from "@/app/(app)/budget/actions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AppBackLink } from "@/components/layout/app-back-link";

// No database access or writes from this public synthetic UI.
async function demoBudgetEdit(_input: BudgetItemFormInput): Promise<ActionResult> {
  "use server";
  void _input;
  return {
    ok: false,
    message: "Mode demo tanpa login. Format input bisa diuji, tetapi anggaran tidak disimpan.",
  };
}

export default function DemoBudgetEditPage() {
  if (!isPublicTestingDemoAllowed()) notFound();

  const category = DEMO_EXPENSE_CATEGORIES.find((item) => item.name === "Food & Beverage");
  if (!category) notFound();

  const initialValues: BudgetItemFormInitialValues = {
    category_id: category.id,
    planned_amount: 550000.41,
    is_fixed: false,
    notes: null,
  };

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader
        title="Ubah anggaran (Demo)"
        titleAction={<AppBackLink href="/testing" label="Kembali ke testing" />}
      />
      <PageContainer>
        <p className="mb-5 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm">
          <strong>Tanpa login · data contoh.</strong> Coba edit batas bulanan
          yang langsung terformat dengan titik ribuan dan koma desimal.
          Checkbox Pengeluaran Tetap sudah tidak ada. Tidak ada data yang disimpan.
          {" "}<Link href="/testing" className="underline">Kembali ke demo</Link>
        </p>
        <BudgetItemForm
          mode="edit"
          action={demoBudgetEdit}
          categories={DEMO_EXPENSE_CATEGORIES}
          monthParam="2026-11"
          initialValues={initialValues}
          cancelHref="/testing"
        />
      </PageContainer>
    </main>
  );
}
