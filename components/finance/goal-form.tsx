"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AccountRow } from "@/lib/accounts";
import { GOAL_ICONS, DEFAULT_GOAL_ICON, parseIdrInput } from "@/lib/goals";
import type { GoalFormInput, ActionResult } from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface GoalFormInitialValues {
  name: string;
  target_amount: number;
  target_date: string | null;
  account_id: string | null;
  notes: string | null;
  status: string;
  icon: string | null;
}

interface GoalFormProps {
  mode: "create" | "edit";
  action: (input: GoalFormInput) => Promise<ActionResult>;
  // Non-archived accounts for the optional link select.
  accounts: AccountRow[];
  initialValues?: GoalFormInitialValues;
}

type FieldErrors = Partial<
  Record<"name" | "target_amount" | "target_date" | "account_id", string>
>;

// Same native-select/date styling used across the app (account/budget forms).
const controlClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

// Status options shown on edit (sentence-case Indonesian labels).
const STATUS_OPTIONS = [
  { value: "active", label: "Aktif" },
  { value: "achieved", label: "Tercapai" },
  { value: "archived", label: "Arsip" },
] as const;

const idrPreview = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function GoalForm({
  mode,
  action,
  accounts,
  initialValues,
}: GoalFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [amountInput, setAmountInput] = useState(
    initialValues ? String(initialValues.target_amount) : "",
  );
  const [targetDate, setTargetDate] = useState(
    initialValues?.target_date ?? "",
  );
  const [accountId, setAccountId] = useState(initialValues?.account_id ?? "");
  const [icon, setIcon] = useState(initialValues?.icon ?? DEFAULT_GOAL_ICON);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [status, setStatus] = useState(initialValues?.status ?? "active");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const nameId = useId();
  const amountId = useId();
  const dateId = useId();
  const accountFieldId = useId();
  const iconId = useId();
  const notesId = useId();
  const statusId = useId();
  const nameErrId = useId();
  const amountErrId = useId();
  const dateErrId = useId();

  const parsedAmount = useMemo(
    () => parseIdrInput(amountInput),
    [amountInput],
  );
  const amountPreview =
    amountInput.trim() === "" || parsedAmount === null
      ? null
      : idrPreview.format(parsedAmount);

  function validateClient(): {
    errors: FieldErrors;
    input: GoalFormInput | null;
  } {
    const errors: FieldErrors = {};

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      errors.name = "Nama target wajib diisi.";
    }

    const amount = parseIdrInput(amountInput);
    if (amount === null || amount <= 0) {
      errors.target_amount = "Nominal target harus lebih dari nol.";
    }

    if (Object.keys(errors).length > 0 || amount === null) {
      return { errors, input: null };
    }

    const trimmedNotes = notes.trim();
    return {
      errors,
      input: {
        name: trimmedName,
        target_amount: amount,
        target_date: targetDate ? targetDate : null,
        account_id: accountId ? accountId : null,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        status,
        icon,
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
        router.push("/goals");
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors as FieldErrors);
      }
      setFormError(result.message);
    });
  }

  const submitLabel = mode === "create" ? "Tambah target" : "Simpan perubahan";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Nama target</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11"
          placeholder="Misal: Dana darurat"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? nameErrId : undefined}
          autoComplete="off"
        />
        {fieldErrors.name ? (
          <p id={nameErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={amountId}>Nominal target</Label>
        <Input
          id={amountId}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          inputMode="numeric"
          className="h-11 tabular-nums"
          placeholder="0"
          aria-invalid={fieldErrors.target_amount ? true : undefined}
          aria-describedby={
            fieldErrors.target_amount ? amountErrId : undefined
          }
        />
        {amountPreview ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {amountPreview}
          </p>
        ) : null}
        {fieldErrors.target_amount ? (
          <p id={amountErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.target_amount}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={dateId}>Target tanggal</Label>
        <input
          id={dateId}
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          aria-invalid={fieldErrors.target_date ? true : undefined}
          aria-describedby={fieldErrors.target_date ? dateErrId : undefined}
          className={cn(controlClassName, "tabular-nums")}
        />
        <p className="text-sm text-muted-foreground">Opsional.</p>
        {fieldErrors.target_date ? (
          <p id={dateErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.target_date}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={accountFieldId}>Rekening terkait</Label>
        <select
          id={accountFieldId}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={cn(controlClassName)}
        >
          <option value="">Tanpa rekening</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          Hanya penanda, tidak memindahkan saldo.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={iconId}>Ikon</Label>
        <select
          id={iconId}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className={cn(controlClassName)}
        >
          {GOAL_ICONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {mode === "edit" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={statusId}>Status</Label>
          <select
            id={statusId}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(controlClassName)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={notesId}>Catatan</Label>
        <Input
          id={notesId}
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
          <Link href="/goals">Batal</Link>
        </Button>
      </div>
    </form>
  );
}
