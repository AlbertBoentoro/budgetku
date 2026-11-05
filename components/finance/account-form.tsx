"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ACCOUNT_TYPES, isAccountType } from "@/lib/accounts";
import {
  formatOpeningBalanceInput,
  openingBalanceInputFromValue,
  parseOpeningBalanceInput,
} from "@/lib/opening-balance-input";
import type { AccountFormInput, ActionResult } from "@/app/(app)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AccountFormInitialValues {
  name: string;
  account_type: string;
  initial_balance: number;
}

interface AccountFormProps {
  mode: "create" | "edit";
  action: (input: AccountFormInput) => Promise<ActionResult>;
  initialValues?: AccountFormInitialValues;
}

type FieldErrors = Partial<
  Record<"name" | "account_type" | "initial_balance", string>
>;

export function AccountForm({ mode, action, initialValues }: AccountFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [accountType, setAccountType] = useState(
    initialValues?.account_type ?? ACCOUNT_TYPES[0].value,
  );
  // The field shows formatted Rupiah ("Rp 123.133"); it is parsed on submit.
  const [balanceInput, setBalanceInput] = useState(
    initialValues ? openingBalanceInputFromValue(initialValues.initial_balance) : "",
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const nameId = useId();
  const typeId = useId();
  const balanceId = useId();
  const nameErrId = useId();
  const typeErrId = useId();
  const balanceErrId = useId();

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
    const balance = parseOpeningBalanceInput(balanceInput);
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
          onChange={(e) =>
            setBalanceInput(formatOpeningBalanceInput(e.target.value))
          }
          inputMode="numeric"
          autoComplete="off"
          className="h-11 tabular-nums"
          placeholder="Rp 0"
          aria-invalid={fieldErrors.initial_balance ? true : undefined}
          aria-describedby={
            fieldErrors.initial_balance ? balanceErrId : undefined
          }
        />
        {fieldErrors.initial_balance ? (
          <p id={balanceErrId} role="alert" className="text-sm text-expense">
            {fieldErrors.initial_balance}
          </p>
        ) : null}
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
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
        <Button asChild type="button" variant="outline" className="h-11">
          <Link href="/accounts">Batal</Link>
        </Button>
      </div>
    </form>
  );
}
