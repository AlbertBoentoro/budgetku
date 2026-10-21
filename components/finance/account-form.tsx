"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  ACCOUNT_TYPES,
  isAccountType,
  parseIdrInput,
} from "@/lib/accounts";
import type { AccountFormInput, ActionResult } from "@/app/(app)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface AccountFormInitialValues {
  name: string;
  account_type: string;
  initial_balance: number;
  include_in_total: boolean;
}

interface AccountFormProps {
  mode: "create" | "edit";
  action: (input: AccountFormInput) => Promise<ActionResult>;
  initialValues?: AccountFormInitialValues;
}

type FieldErrors = Partial<
  Record<"name" | "account_type" | "initial_balance", string>
>;

const idrPreview = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function AccountForm({ mode, action, initialValues }: AccountFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [accountType, setAccountType] = useState(
    initialValues?.account_type ?? ACCOUNT_TYPES[0].value,
  );
  // Keep the raw string so the user can type freely; parse on submit/preview.
  const [balanceInput, setBalanceInput] = useState(
    initialValues ? String(initialValues.initial_balance) : "",
  );
  const [includeInTotal, setIncludeInTotal] = useState(
    initialValues?.include_in_total ?? true,
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const nameId = useId();
  const typeId = useId();
  const balanceId = useId();
  const includeId = useId();
  const nameErrId = useId();
  const typeErrId = useId();
  const balanceErrId = useId();

  const parsedBalance = useMemo(
    () => parseIdrInput(balanceInput),
    [balanceInput],
  );

  const balancePreview =
    balanceInput.trim() === "" || parsedBalance === null
      ? null
      : idrPreview.format(parsedBalance);

  function validateClient(): {
    errors: FieldErrors;
    input: AccountFormInput | null;
  } {
    const errors: FieldErrors = {};

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      errors.name = "Nama rekening wajib diisi.";
    }
    if (!isAccountType(accountType)) {
      errors.account_type = "Pilih jenis rekening yang tersedia.";
    }
    const balance = parseIdrInput(balanceInput || "0");
    if (balance === null) {
      errors.initial_balance = "Saldo awal harus berupa angka yang valid.";
    }

    if (Object.keys(errors).length > 0 || balance === null) {
      return { errors, input: null };
    }

    return {
      errors,
      input: {
        name: trimmedName,
        account_type: accountType,
        initial_balance: balance,
        include_in_total: includeInTotal,
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
        router.push("/accounts");
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors as FieldErrors);
      }
      setFormError(result.message);
    });
  }

  const submitLabel = mode === "create" ? "Tambah rekening" : "Simpan perubahan";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Nama rekening</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11"
          placeholder="Misal: BCA utama"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? nameErrId : undefined}
          autoComplete="off"
        />
        {fieldErrors.name ? (
          <p id={nameErrId} role="alert" className="text-sm text-expense">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={typeId}>Jenis rekening</Label>
        <select
          id={typeId}
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          aria-invalid={fieldErrors.account_type ? true : undefined}
          aria-describedby={fieldErrors.account_type ? typeErrId : undefined}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          )}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {fieldErrors.account_type ? (
          <p id={typeErrId} role="alert" className="text-sm text-expense">
            {fieldErrors.account_type}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={balanceId}>Saldo awal</Label>
        <Input
          id={balanceId}
          value={balanceInput}
          onChange={(e) => setBalanceInput(e.target.value)}
          inputMode="numeric"
          className="h-11 tabular-nums"
          placeholder="0"
          aria-invalid={fieldErrors.initial_balance ? true : undefined}
          aria-describedby={
            fieldErrors.initial_balance ? balanceErrId : undefined
          }
        />
        {balancePreview ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {balancePreview}
          </p>
        ) : null}
        {fieldErrors.initial_balance ? (
          <p id={balanceErrId} role="alert" className="text-sm text-expense">
            {fieldErrors.initial_balance}
          </p>
        ) : null}
      </div>

      <label
        htmlFor={includeId}
        className="flex items-center gap-3 rounded-md border bg-card p-3"
      >
        <Checkbox
          id={includeId}
          className="size-5"
          checked={includeInTotal}
          onCheckedChange={(v) => setIncludeInTotal(v === true)}
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium">Masukkan dalam total</span>
          <span className="text-sm text-muted-foreground">
            Hitung saldo rekening ini pada total saldo.
          </span>
        </span>
      </label>

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
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
        <Button asChild type="button" variant="outline" className="h-11">
          <Link href="/accounts">Batal</Link>
        </Button>
      </div>
    </form>
  );
}
