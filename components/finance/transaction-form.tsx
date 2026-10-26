"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  isTransactionType,
  parseIdrInput,
  type AccountRow,
  type CategoryRow,
} from "@/lib/transactions";
import type {
  TransactionFormInput,
  ActionResult,
} from "@/app/(app)/transactions/actions";
import { FREQUENCIES } from "@/lib/recurring";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TransactionTypeSwitcher } from "@/components/transactions/transaction-type-switcher";
import { TransactionFieldRow } from "@/components/transactions/transaction-field-row";
import { ToggleSwitch } from "@/components/transactions/toggle-switch";

export interface TransactionFormInitialValues {
  transaction_type: string;
  amount: number;
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  transaction_at: string;
  description: string | null;
  merchant: string | null;
}

interface TransactionFormProps {
  mode: "create" | "edit";
  action: (input: TransactionFormInput) => Promise<ActionResult>;
  accounts: AccountRow[];
  incomeCategories: CategoryRow[];
  expenseCategories: CategoryRow[];
  initialValues?: TransactionFormInitialValues;
}

type FieldErrors = Partial<
  Record<
    | "amount"
    | "account_id"
    | "category_id"
    | "destination_account_id"
    | "transaction_type"
    | "frequency"
    | "end_date",
    string
  >
>;

// Same native-select styling the account form and filters use, kept identical
// so every select in the app matches.
const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const idrPreview = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Today as YYYY-MM-DD in the user's local time, matching the <input type=date>
// value format so the field defaults to today.
function todayValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Normalizes a stored transaction_at (ISO timestamp or date) to the YYYY-MM-DD
// the date input expects, falling back to today if it cannot be parsed.
function toDateInputValue(value: string | undefined): string {
  if (!value) return todayValue();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    // Already a plain YYYY-MM-DD string.
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayValue();
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransactionForm({
  mode,
  action,
  accounts,
  incomeCategories,
  expenseCategories,
  initialValues,
}: TransactionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialType: string =
    initialValues && isTransactionType(initialValues.transaction_type)
      ? initialValues.transaction_type
      : "expense";

  const [transactionType, setTransactionType] = useState<string>(initialType);
  // Keep the raw string so the user can type freely; parse on submit/preview.
  const [amountInput, setAmountInput] = useState(
    initialValues ? String(initialValues.amount) : "",
  );
  const [accountId, setAccountId] = useState(
    initialValues?.account_id ?? accounts[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(
    initialValues?.category_id ?? "",
  );
  const [destinationAccountId, setDestinationAccountId] = useState(
    initialValues?.destination_account_id ?? "",
  );
  const [transactionAt, setTransactionAt] = useState(
    toDateInputValue(initialValues?.transaction_at),
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [merchant, setMerchant] = useState(initialValues?.merchant ?? "");

  // Recurrence is create-only. Monthly is the common default for gajian/tagihan.
  // By default the schedule has no end date (see `indefinite` below); the user
  // can instead pick a Berakhir date. interval_count is fixed at 1 (no interval
  // field).
  const isCreate = mode === "create";
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<string>("monthly");
  // Indefinite defaults to checked: it preserves today's behaviour (the create
  // flow stored end_date = null) and matches the common "berulang sampai waktu
  // yang tidak ditentukan" case. The Berakhir field only appears, and is only
  // required, when the user opts into a bounded schedule.
  const [indefinite, setIndefinite] = useState(true);
  const [endDate, setEndDate] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const amountId = useId();
  const typeLabelId = useId();
  const accountFieldId = useId();
  const categoryFieldId = useId();
  const destinationFieldId = useId();
  const dateId = useId();
  const descriptionId = useId();
  const merchantId = useId();
  const amountErrId = useId();
  const accountErrId = useId();
  const categoryErrId = useId();
  const destinationErrId = useId();
  const recurringId = useId();
  const recurringHelpId = useId();
  const frequencyId = useId();
  const frequencyErrId = useId();
  const indefiniteId = useId();
  const indefiniteHelpId = useId();
  const endDateId = useId();
  const endDateErrId = useId();

  const isTransfer = transactionType === "transfer";
  const isIncome = transactionType === "income";

  // Category options follow the selected direction. Transfers have no category.
  const categoryOptions = isIncome ? incomeCategories : expenseCategories;

  // Destination excludes the chosen source so a transfer cannot target itself.
  const destinationOptions = useMemo(
    () => accounts.filter((a) => a.id !== accountId),
    [accounts, accountId],
  );

  const parsedAmount = useMemo(
    () => parseIdrInput(amountInput),
    [amountInput],
  );

  const amountPreview =
    amountInput.trim() === "" || parsedAmount === null
      ? null
      : idrPreview.format(parsedAmount);

  // Type-dependent hero label. Transfer has no income/expense direction.
  const amountLabel = isIncome
    ? "Nominal Pemasukan"
    : isTransfer
      ? "Nominal Transfer"
      : "Nominal Pengeluaran";

  // Preset chips add a round figure to the current amount by parsing what is
  // there, adding the delta, and writing back a plain digit string so the
  // existing parseIdrInput/preview keep working. Reset clears the field. This
  // mutates the single source of truth (amountInput); it never fakes a value.
  function addPreset(delta: number) {
    const current = parseIdrInput(amountInput) ?? 0;
    const next = current + delta;
    setAmountInput(String(next));
    setFieldErrors((prev) => ({ ...prev, amount: undefined }));
  }

  function resetAmount() {
    setAmountInput("");
  }

  const PRESETS = [
    { label: "+20rb", delta: 20000 },
    { label: "+50rb", delta: 50000 },
    { label: "+100rb", delta: 100000 },
  ] as const;

  // Switching type clears the fields that no longer apply so a hidden value is
  // never submitted (mirrors the server, which nulls them anyway).
  function handleTypeChange(nextType: string) {
    setTransactionType(nextType);
    setFieldErrors((prev) => ({
      ...prev,
      category_id: undefined,
      destination_account_id: undefined,
      transaction_type: undefined,
    }));
    if (nextType === "transfer") {
      setCategoryId("");
    } else {
      setDestinationAccountId("");
    }
  }

  function handleAccountChange(nextAccountId: string) {
    setAccountId(nextAccountId);
    // If the source now equals the destination, clear the destination so the
    // user re-picks a valid target.
    if (nextAccountId === destinationAccountId) {
      setDestinationAccountId("");
    }
  }

  // Client-side validation mirroring validate() in actions.ts so errors show
  // inline before the request; the server still re-checks everything.
  function validateClient(): {
    errors: FieldErrors;
    input: TransactionFormInput | null;
  } {
    const errors: FieldErrors = {};

    const amount = parseIdrInput(amountInput);
    if (amount === null || amount <= 0) {
      errors.amount = "Nominal harus berupa angka lebih dari nol.";
    }

    if (!accountId) {
      errors.account_id = "Pilih rekening sumber.";
    }

    if (!isTransactionType(transactionType)) {
      errors.transaction_type = "Pilih jenis transaksi yang tersedia.";
    }

    if (transactionType === "income" || transactionType === "expense") {
      if (!categoryId) {
        errors.category_id = "Pilih kategori transaksi.";
      }
    }

    if (transactionType === "transfer") {
      if (!destinationAccountId) {
        errors.destination_account_id = "Pilih rekening tujuan.";
      } else if (destinationAccountId === accountId) {
        errors.destination_account_id =
          "Rekening tujuan harus berbeda dari rekening sumber.";
      }
    }

    if (isCreate && recurring) {
      if (!frequency) {
        errors.frequency = "Pilih frekuensi yang tersedia.";
      }
      // Mirrors the server: only a bounded schedule needs an end date, and it
      // cannot fall before the transaction date (the recurrence start).
      if (!indefinite) {
        if (!endDate) {
          errors.end_date = "Tanggal berakhir wajib diisi.";
        } else if (endDate < transactionAt) {
          errors.end_date =
            "Tanggal berakhir tidak boleh sebelum tanggal transaksi.";
        }
      }
    }

    if (Object.keys(errors).length > 0 || amount === null) {
      return { errors, input: null };
    }

    const trimmedDescription = description.trim();
    const trimmedMerchant = merchant.trim();
    const useRecurring = isCreate && recurring;

    return {
      errors,
      input: {
        transaction_type: transactionType,
        amount,
        account_id: accountId,
        category_id: isTransfer ? null : categoryId,
        destination_account_id: isTransfer ? destinationAccountId : null,
        transaction_at: transactionAt,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        merchant: trimmedMerchant.length > 0 ? trimmedMerchant : null,
        recurring: useRecurring,
        frequency: useRecurring ? frequency : null,
        interval_count: useRecurring ? 1 : null,
        recurring_indefinite: useRecurring ? indefinite : undefined,
        end_date: useRecurring && !indefinite ? endDate : null,
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
        router.push("/transactions");
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors as FieldErrors);
      }
      setFormError(result.message);
    });
  }

  const submitLabel =
    mode === "create" ? "Tambah transaksi" : "Simpan perubahan";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <span id={typeLabelId} className="text-body-md font-medium text-on-surface">
          Jenis transaksi
        </span>
        <TransactionTypeSwitcher
          value={transactionType}
          onChange={handleTypeChange}
          labelId={typeLabelId}
        />
        {fieldErrors.transaction_type ? (
          <p role="alert" className="text-body-sm text-expense">
            {fieldErrors.transaction_type}
          </p>
        ) : null}
      </div>

      {/* Hero amount card: a large "Rp" prefix + the SAME amount input rendered
          at display size, with functional preset chips. No fake caret, no
          perpetual animation, no decorative glow. */}
      <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <Label
          htmlFor={amountId}
          className="text-label-md uppercase text-on-surface-variant"
        >
          {amountLabel}
        </Label>
        <div className="flex items-baseline justify-center gap-1">
          <span
            aria-hidden
            className="text-currency-display font-semibold text-on-surface-variant"
          >
            Rp
          </span>
          <Input
            id={amountId}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            inputMode="numeric"
            className="h-auto border-0 bg-transparent p-0 text-center text-[2.75rem] font-bold leading-[1.1] tracking-tight tabular-nums shadow-none focus-visible:ring-0 md:text-[2.75rem]"
            placeholder="0"
            aria-invalid={fieldErrors.amount ? true : undefined}
            aria-describedby={fieldErrors.amount ? amountErrId : undefined}
          />
        </div>
        {amountPreview ? (
          <p className="text-center text-body-sm text-on-surface-variant tabular-nums">
            {amountPreview}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => addPreset(preset.delta)}
              className="flex h-11 items-center rounded-full bg-surface-container-low px-3 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetAmount}
            className="flex h-11 items-center rounded-full px-3 text-body-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reset
          </button>
        </div>
        {fieldErrors.amount ? (
          <p
            id={amountErrId}
            role="alert"
            className="text-center text-body-sm text-expense"
          >
            {fieldErrors.amount}
          </p>
        ) : null}
      </div>

      {/* Field rows grouped in one card with dividers. Every control keeps its
          existing value/onChange/id/aria wiring and show-hide conditionals. */}
      <div className="flex flex-col divide-y divide-border rounded-xl bg-surface-container-lowest shadow-sm">
        <TransactionFieldRow
          icon="account_balance_wallet"
          htmlFor={accountFieldId}
          label="Rekening sumber"
          error={
            fieldErrors.account_id ? (
              <p
                id={accountErrId}
                role="alert"
                className="text-body-sm text-expense"
              >
                {fieldErrors.account_id}
              </p>
            ) : null
          }
        >
          <select
            id={accountFieldId}
            value={accountId}
            onChange={(e) => handleAccountChange(e.target.value)}
            aria-invalid={fieldErrors.account_id ? true : undefined}
            aria-describedby={fieldErrors.account_id ? accountErrId : undefined}
            className={cn(selectClassName)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </TransactionFieldRow>

        {isTransfer ? (
          <TransactionFieldRow
            icon="sync_alt"
            htmlFor={destinationFieldId}
            label="Rekening tujuan"
            error={
              fieldErrors.destination_account_id ? (
                <p
                  id={destinationErrId}
                  role="alert"
                  className="text-body-sm text-expense"
                >
                  {fieldErrors.destination_account_id}
                </p>
              ) : null
            }
          >
            <select
              id={destinationFieldId}
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              aria-invalid={
                fieldErrors.destination_account_id ? true : undefined
              }
              aria-describedby={
                fieldErrors.destination_account_id
                  ? destinationErrId
                  : undefined
              }
              className={cn(selectClassName)}
            >
              <option value="">Pilih rekening tujuan</option>
              {destinationOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </TransactionFieldRow>
        ) : (
          <TransactionFieldRow
            icon="category"
            htmlFor={categoryFieldId}
            label="Kategori"
            error={
              fieldErrors.category_id ? (
                <p
                  id={categoryErrId}
                  role="alert"
                  className="text-body-sm text-expense"
                >
                  {fieldErrors.category_id}
                </p>
              ) : null
            }
          >
            <select
              id={categoryFieldId}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-invalid={fieldErrors.category_id ? true : undefined}
              aria-describedby={
                fieldErrors.category_id ? categoryErrId : undefined
              }
              className={cn(selectClassName)}
            >
              <option value="">Pilih kategori</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </TransactionFieldRow>
        )}

        <TransactionFieldRow
          icon="calendar_today"
          htmlFor={dateId}
          label="Tanggal"
        >
          <Input
            id={dateId}
            type="date"
            value={transactionAt}
            onChange={(e) => setTransactionAt(e.target.value)}
            className="h-11"
          />
        </TransactionFieldRow>

        <TransactionFieldRow icon="store" htmlFor={merchantId} label="Toko">
          <Input
            id={merchantId}
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="h-11"
            placeholder="Opsional, misal: Kopi Kenangan"
            autoComplete="off"
          />
        </TransactionFieldRow>

        <TransactionFieldRow
          icon="notes"
          htmlFor={descriptionId}
          label="Catatan"
        >
          <Input
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-11"
            placeholder="Opsional"
            autoComplete="off"
          />
        </TransactionFieldRow>
      </div>

      {isCreate ? (
        <div className="flex flex-col divide-y divide-border rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="flex items-center gap-3 p-lg">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <Icon name="repeat" size={20} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={recurringId} className="text-body-md text-on-surface">
                Jadikan transaksi berulang
              </Label>
              <p
                id={recurringHelpId}
                className="text-body-sm text-on-surface-variant"
              >
                Simpan jadwalnya, lalu catat setiap kejadian berikutnya dari
                halaman Transaksi berulang.
              </p>
            </div>
            <ToggleSwitch
              id={recurringId}
              checked={recurring}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setRecurring(next);
                if (!next) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    frequency: undefined,
                    end_date: undefined,
                  }));
                }
              }}
              aria-describedby={recurringHelpId}
            />
          </div>

          {recurring ? (
            <div className="flex flex-col gap-4 p-lg">
              <div className="flex flex-col gap-2">
                <Label htmlFor={frequencyId}>Frekuensi</Label>
                <select
                  id={frequencyId}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  aria-invalid={fieldErrors.frequency ? true : undefined}
                  aria-describedby={
                    fieldErrors.frequency ? frequencyErrId : undefined
                  }
                  className={cn(selectClassName)}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.frequency ? (
                  <p
                    id={frequencyErrId}
                    role="alert"
                    className="text-body-sm text-expense"
                  >
                    {fieldErrors.frequency}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Label
                    htmlFor={indefiniteId}
                    className="text-body-md text-on-surface"
                  >
                    Sampai waktu yang tidak ditentukan
                  </Label>
                  <p
                    id={indefiniteHelpId}
                    className="text-body-sm text-on-surface-variant"
                  >
                    Aktif secara bawaan. Matikan untuk memilih tanggal
                    berakhir.
                  </p>
                </div>
                <ToggleSwitch
                  id={indefiniteId}
                  checked={indefinite}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    setIndefinite(next);
                    if (next) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        end_date: undefined,
                      }));
                    }
                  }}
                  aria-describedby={indefiniteHelpId}
                />
              </div>

              {!indefinite ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={endDateId}>Berakhir</Label>
                  <Input
                    id={endDateId}
                    type="date"
                    value={endDate}
                    min={transactionAt}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setFieldErrors((prev) => ({
                        ...prev,
                        end_date: undefined,
                      }));
                    }}
                    className="h-11"
                    aria-invalid={fieldErrors.end_date ? true : undefined}
                    aria-describedby={
                      fieldErrors.end_date ? endDateErrId : undefined
                    }
                  />
                  {fieldErrors.end_date ? (
                    <p
                      id={endDateErrId}
                      role="alert"
                      className="text-body-sm text-expense"
                    >
                      {fieldErrors.end_date}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" className="h-11 w-full" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
        <Button asChild type="button" variant="outline" className="h-11 w-full">
          <Link href="/transactions">Batal</Link>
        </Button>
      </div>
    </form>
  );
}
