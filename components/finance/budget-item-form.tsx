"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { parseIdrInput, type CategoryRow } from "@/lib/budgets";
import type {
  BudgetItemFormInput,
  ActionResult,
} from "@/app/(app)/budget/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface BudgetItemFormInitialValues {
  category_id: string;
  planned_amount: number;
  is_fixed: boolean;
  notes: string | null;
}

interface BudgetItemFormProps {
  mode: "create" | "edit";
  action: (input: BudgetItemFormInput) => Promise<ActionResult>;
  categories: CategoryRow[];
  monthParam: string;
  // Categories already budgeted this month: hidden on create to prevent a
  // duplicate; the item's own category stays available on edit.
  usedCategoryIds?: string[];
  initialValues?: BudgetItemFormInitialValues;
}

type FieldErrors = Partial<
  Record<"category_id" | "planned_amount", string>
>;

// Same native-select styling used across the app (account/transaction forms).
const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const idrPreview = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function BudgetItemForm({
  mode,
  action,
  categories,
  monthParam,
  usedCategoryIds = [],
  initialValues,
}: BudgetItemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // On create, hide already-budgeted categories so a duplicate cannot be
  // chosen. On edit, keep the item's current category selectable.
  const usedSet = useMemo(
    () => new Set(usedCategoryIds),
    [usedCategoryIds],
  );
  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (c) =>
          !usedSet.has(c.id) || c.id === initialValues?.category_id,
      ),
    [categories, usedSet, initialValues?.category_id],
  );

  const [categoryId, setCategoryId] = useState(
    initialValues?.category_id ?? "",
  );
  const [amountInput, setAmountInput] = useState(
    initialValues ? String(initialValues.planned_amount) : "",
  );
  const [isFixed, setIsFixed] = useState(initialValues?.is_fixed ?? false);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const categoryFieldId = useId();
  const amountFieldId = useId();
  const notesFieldId = useId();
  const fixedFieldId = useId();
  const categoryErrId = useId();
  const amountErrId = useId();

  const parsedAmount = useMemo(() => parseIdrInput(amountInput), [amountInput]);
  const amountPreview =
    amountInput.trim() === "" || parsedAmount === null
      ? null
      : idrPreview.format(parsedAmount);

  function validateClient(): {
    errors: FieldErrors;
    input: BudgetItemFormInput | null;
  } {
    const errors: FieldErrors = {};

    if (!categoryId) {
      errors.category_id = "Pilih kategori pengeluaran.";
    } else if (
      usedSet.has(categoryId) &&
      categoryId !== initialValues?.category_id
    ) {
      errors.category_id = "Kategori ini sudah dianggarkan.";
    }

    const amount = parseIdrInput(amountInput);
    if (amount === null || amount <= 0) {
      errors.planned_amount = "Batas harus berupa angka lebih dari nol.";
    }

    if (Object.keys(errors).length > 0 || amount === null) {
      return { errors, input: null };
    }

    const trimmedNotes = notes.trim();
    return {
      errors,
      input: {
        category_id: categoryId,
        planned_amount: amount,
        is_fixed: isFixed,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      },
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const { errors, input } = validateClient();
    setFieldErrors(errors);
    if (!input) return;

    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        router.push(`/budget?month=${monthParam}`);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors as FieldErrors);
      }
      setFormError(result.message);
    });
  }

  const submitLabel = mode === "create" ? "Tambah kategori" : "Simpan perubahan";

  // No selectable categories left to budget (create flow): guide the user back
  // rather than render an empty select.
  if (mode === "create" && categoryOptions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          Semua kategori pengeluaran sudah dianggarkan untuk bulan ini.
        </p>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/budget?month=${monthParam}`}>Kembali ke anggaran</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={categoryFieldId}>Kategori pengeluaran</Label>
        <select
          id={categoryFieldId}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-invalid={fieldErrors.category_id ? true : undefined}
          aria-describedby={fieldErrors.category_id ? categoryErrId : undefined}
          className={cn(selectClassName)}
        >
          <option value="">Pilih kategori</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {fieldErrors.category_id ? (
          <p
            id={categoryErrId}
            role="alert"
            className="text-sm text-destructive"
          >
            {fieldErrors.category_id}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={amountFieldId}>Batas per bulan</Label>
        <Input
          id={amountFieldId}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          inputMode="numeric"
          className="h-11 tabular-nums"
          placeholder="0"
          aria-invalid={fieldErrors.planned_amount ? true : undefined}
          aria-describedby={
            fieldErrors.planned_amount ? amountErrId : undefined
          }
        />
        {amountPreview ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {amountPreview}
          </p>
        ) : null}
        {fieldErrors.planned_amount ? (
          <p id={amountErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.planned_amount}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id={fixedFieldId}
          checked={isFixed}
          onCheckedChange={(checked) => setIsFixed(checked === true)}
          className="mt-0.5"
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={fixedFieldId}>Pengeluaran tetap</Label>
          <p className="text-sm text-muted-foreground">
            Tandai bila nilainya relatif sama tiap bulan, misal cicilan.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={notesFieldId}>Catatan</Label>
        <Input
          id={notesFieldId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-11"
          placeholder="Opsional"
          autoComplete="off"
        />
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" className="h-11 flex-1" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
        <Button asChild type="button" variant="outline" className="h-11">
          <Link href={`/budget?month=${monthParam}`}>Batal</Link>
        </Button>
      </div>
    </form>
  );
}
