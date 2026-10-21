"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { parseIdrInput } from "@/lib/goals";
import type {
  ContributionFormInput,
  ActionResult,
} from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContributionFormProps {
  goalId: string;
  action: (input: ContributionFormInput) => Promise<ActionResult>;
}

type FieldErrors = Partial<Record<"amount" | "contributed_at", string>>;

const controlClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const idrPreview = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Today's date as "YYYY-MM-DD" in local time, for the default contribution
// date. Computed once per render on the client.
function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ContributionForm({ goalId, action }: ContributionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [amountInput, setAmountInput] = useState("");
  const [contributedAt, setContributedAt] = useState(() => todayInputValue());
  const [note, setNote] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const amountId = useId();
  const dateId = useId();
  const noteId = useId();
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
    input: ContributionFormInput | null;
  } {
    const errors: FieldErrors = {};

    const amount = parseIdrInput(amountInput);
    if (amount === null || amount <= 0) {
      errors.amount = "Nominal harus lebih dari nol.";
    }

    if (Object.keys(errors).length > 0 || amount === null) {
      return { errors, input: null };
    }

    const trimmedNote = note.trim();
    return {
      errors,
      input: {
        amount,
        contributed_at: contributedAt ? contributedAt : null,
        note: trimmedNote.length > 0 ? trimmedNote : null,
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
        router.push(`/goals/${goalId}`);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors as FieldErrors);
      }
      setFormError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={amountId}>Nominal</Label>
        <Input
          id={amountId}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          inputMode="numeric"
          className="h-11 tabular-nums"
          placeholder="0"
          aria-invalid={fieldErrors.amount ? true : undefined}
          aria-describedby={fieldErrors.amount ? amountErrId : undefined}
        />
        {amountPreview ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {amountPreview}
          </p>
        ) : null}
        {fieldErrors.amount ? (
          <p id={amountErrId} role="alert" className="text-sm text-expense">
            {fieldErrors.amount}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={dateId}>Tanggal</Label>
        <input
          id={dateId}
          type="date"
          value={contributedAt}
          onChange={(e) => setContributedAt(e.target.value)}
          aria-invalid={fieldErrors.contributed_at ? true : undefined}
          aria-describedby={
            fieldErrors.contributed_at ? dateErrId : undefined
          }
          className={cn(controlClassName, "tabular-nums")}
        />
        {fieldErrors.contributed_at ? (
          <p id={dateErrId} role="alert" className="text-sm text-expense">
            {fieldErrors.contributed_at}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={noteId}>Catatan</Label>
        <Input
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-11"
          placeholder="Opsional"
          autoComplete="off"
        />
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-expense"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" className="h-11 flex-1" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Tambah kontribusi"}
        </Button>
        <Button asChild type="button" variant="outline" className="h-11">
          <Link href={`/goals/${goalId}`}>Batal</Link>
        </Button>
      </div>
    </form>
  );
}
