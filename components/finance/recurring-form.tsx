"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  FREQUENCIES,
  TRANSACTION_TYPES,
  isFrequency,
  isTransactionType,
  parseIdrInput,
  type AccountRow,
  type CategoryRow,
} from "@/lib/recurring";
import type {
  RecurringFormInput,
  ActionResult,
} from "@/app/(app)/recurring/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RecurringFormInitialValues {
  name: string;
  transaction_type: string;
  amount: number;
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  frequency: string;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  auto_create: boolean;
  is_active: boolean;
  description: string | null;
  merchant: string | null;
}

interface RecurringFormProps {
  mode: "create" | "edit";
  action: (input: RecurringFormInput) => Promise<ActionResult>;
  accounts: AccountRow[];
  incomeCategories: CategoryRow[];
  expenseCategories: CategoryRow[];
  initialValues?: RecurringFormInitialValues;
}

type FieldErrors = Partial<
  Record<
    | "name"
    | "amount"
    | "account_id"
    | "category_id"
    | "destination_account_id"
    | "transaction_type"
    | "frequency"
    | "interval_count"
    | "start_date"
    | "end_date"
    | "next_due_date",
    string
  >
>;

// Same native-select styling every other select in the app uses.
const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const idrPreview = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Today as YYYY-MM-DD in local time, matching the <input type=date> format so
// the start date defaults to today.
function todayValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Normalizes a stored date (ISO timestamp or plain date) to the YYYY-MM-DD the
// date input expects, falling back to a given default when it cannot parse.
function toDateInputValue(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function RecurringForm({
  mode,
  action,
  accounts,
  incomeCategories,
  expenseCategories,
  initialValues,
}: RecurringFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialType: string =
    initialValues && isTransactionType(initialValues.transaction_type)
      ? initialValues.transaction_type
      : "expense";

  const initialFrequency: string =
    initialValues && isFrequency(initialValues.frequency)
      ? initialValues.frequency
      : "monthly";

  const defaultStart = todayValue();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [transactionType, setTransactionType] = useState<string>(initialType);
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
  const [frequency, setFrequency] = useState<string>(initialFrequency);
  const [intervalInput, setIntervalInput] = useState(
    initialValues ? String(initialValues.interval_count) : "1",
  );
  const [startDate, setStartDate] = useState(
    toDateInputValue(initialValues?.start_date, defaultStart),
  );
  const [endDate, setEndDate] = useState(
    initialValues?.end_date
      ? toDateInputValue(initialValues.end_date, "")
      : "",
  );
  const [nextDueDate, setNextDueDate] = useState(
    toDateInputValue(
      initialValues?.next_due_date,
      toDateInputValue(initialValues?.start_date, defaultStart),
    ),
  );
  const [autoCreate, setAutoCreate] = useState(
    initialValues?.auto_create ?? false,
  );
  const [isActive, setIsActive] = useState(initialValues?.is_active ?? true);
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [merchant, setMerchant] = useState(initialValues?.merchant ?? "");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const nameId = useId();
  const amountId = useId();
  const typeLabelId = useId();
  const accountFieldId = useId();
  const categoryFieldId = useId();
  const destinationFieldId = useId();
  const frequencyFieldId = useId();
  const intervalId = useId();
  const startDateId = useId();
  const endDateId = useId();
  const nextDueId = useId();
  const autoCreateId = useId();
  const isActiveId = useId();
  const descriptionId = useId();
  const merchantId = useId();
  const nameErrId = useId();
  const amountErrId = useId();
  const accountErrId = useId();
  const categoryErrId = useId();
  const destinationErrId = useId();
  const frequencyErrId = useId();
  const intervalErrId = useId();
  const startDateErrId = useId();
  const endDateErrId = useId();
  const nextDueErrId = useId();

  const isTransfer = transactionType === "transfer";
  const isIncome = transactionType === "income";

  const categoryOptions = isIncome ? incomeCategories : expenseCategories;

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
    if (nextAccountId === destinationAccountId) {
      setDestinationAccountId("");
    }
  }

  // Client-side validation mirroring validate() in actions.ts so errors show
  // inline before the request; the server still re-checks everything.
  function validateClient(): {
    errors: FieldErrors;
    input: RecurringFormInput | null;
  } {
    const errors: FieldErrors = {};

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      errors.name = "Nama transaksi berulang wajib diisi.";
    }

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

    if (!isFrequency(frequency)) {
      errors.frequency = "Pilih frekuensi yang tersedia.";
    }

    const interval = Number(intervalInput);
    if (!Number.isInteger(interval) || interval < 1) {
      errors.interval_count = "Interval minimal 1.";
    }

    if (!startDate) {
      errors.start_date = "Pilih tanggal mulai.";
    }

    if (endDate && startDate && endDate < startDate) {
      errors.end_date = "Tanggal berakhir tidak boleh sebelum tanggal mulai.";
    }

    if (Object.keys(errors).length > 0 || amount === null) {
      return { errors, input: null };
    }

    const trimmedDescription = description.trim();
    const trimmedMerchant = merchant.trim();

    return {
      errors,
      input: {
        name: trimmedName,
        transaction_type: transactionType,
        amount,
        account_id: accountId,
        category_id: isTransfer ? null : categoryId,
        destination_account_id: isTransfer ? destinationAccountId : null,
        frequency,
        interval_count: interval,
        start_date: startDate,
        end_date: endDate ? endDate : null,
        next_due_date: nextDueDate ? nextDueDate : startDate,
        auto_create: autoCreate,
        is_active: isActive,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        merchant: trimmedMerchant.length > 0 ? trimmedMerchant : null,
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
        router.push("/recurring");
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
    mode === "create" ? "Tambah transaksi berulang" : "Simpan perubahan";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Nama</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11"
          placeholder="Misal: Langganan internet"
          autoComplete="off"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? nameErrId : undefined}
        />
        {fieldErrors.name ? (
          <p id={nameErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span id={typeLabelId} className="text-sm font-medium">
          Jenis transaksi
        </span>
        <div
          role="group"
          aria-labelledby={typeLabelId}
          className="grid grid-cols-3 gap-2"
        >
          {TRANSACTION_TYPES.map((type) => {
            const selected = transactionType === type.value;
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                aria-pressed={selected}
                onClick={() => handleTypeChange(type.value)}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-md border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

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
          <p id={amountErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.amount}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={accountFieldId}>Dari rekening</Label>
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
        {fieldErrors.account_id ? (
          <p id={accountErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.account_id}
          </p>
        ) : null}
      </div>

      {isTransfer ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={destinationFieldId}>Ke rekening</Label>
          <select
            id={destinationFieldId}
            value={destinationAccountId}
            onChange={(e) => setDestinationAccountId(e.target.value)}
            aria-invalid={fieldErrors.destination_account_id ? true : undefined}
            aria-describedby={
              fieldErrors.destination_account_id ? destinationErrId : undefined
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
          {fieldErrors.destination_account_id ? (
            <p
              id={destinationErrId}
              role="alert"
              className="text-sm text-destructive"
            >
              {fieldErrors.destination_account_id}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={categoryFieldId}>Kategori</Label>
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
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={frequencyFieldId}>Frekuensi</Label>
        <select
          id={frequencyFieldId}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          aria-invalid={fieldErrors.frequency ? true : undefined}
          aria-describedby={fieldErrors.frequency ? frequencyErrId : undefined}
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
            className="text-sm text-destructive"
          >
            {fieldErrors.frequency}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={intervalId}>Setiap</Label>
        <Input
          id={intervalId}
          value={intervalInput}
          onChange={(e) => setIntervalInput(e.target.value)}
          inputMode="numeric"
          type="number"
          min={1}
          step={1}
          className="h-11 tabular-nums"
          aria-invalid={fieldErrors.interval_count ? true : undefined}
          aria-describedby={
            fieldErrors.interval_count ? intervalErrId : undefined
          }
        />
        <p className="text-sm text-muted-foreground">
          Angka 1 berarti setiap periode. Misal 2 dengan frekuensi minggu
          berarti setiap 2 minggu.
        </p>
        {fieldErrors.interval_count ? (
          <p
            id={intervalErrId}
            role="alert"
            className="text-sm text-destructive"
          >
            {fieldErrors.interval_count}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={startDateId}>Mulai</Label>
        <Input
          id={startDateId}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-11"
          aria-invalid={fieldErrors.start_date ? true : undefined}
          aria-describedby={fieldErrors.start_date ? startDateErrId : undefined}
        />
        {fieldErrors.start_date ? (
          <p
            id={startDateErrId}
            role="alert"
            className="text-sm text-destructive"
          >
            {fieldErrors.start_date}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={endDateId}>Berakhir</Label>
        <Input
          id={endDateId}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-11"
          aria-invalid={fieldErrors.end_date ? true : undefined}
          aria-describedby={fieldErrors.end_date ? endDateErrId : undefined}
        />
        <p className="text-sm text-muted-foreground">
          Opsional. Kosongkan jika tidak ada tanggal berakhir.
        </p>
        {fieldErrors.end_date ? (
          <p id={endDateErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.end_date}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={nextDueId}>Jatuh tempo berikutnya</Label>
        <Input
          id={nextDueId}
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          className="h-11"
          aria-invalid={fieldErrors.next_due_date ? true : undefined}
          aria-describedby={fieldErrors.next_due_date ? nextDueErrId : undefined}
        />
        <p className="text-sm text-muted-foreground">
          Secara bawaan sama dengan tanggal mulai.
        </p>
        {fieldErrors.next_due_date ? (
          <p id={nextDueErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.next_due_date}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id={autoCreateId}
          checked={autoCreate}
          onCheckedChange={(checked) => setAutoCreate(checked === true)}
          className="mt-0.5"
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={autoCreateId}>Buat otomatis</Label>
          <p className="text-sm text-muted-foreground">
            Tandai sebagai preferensi. Pencatatan tetap kamu lakukan lewat
            tombol Catat sekarang.
          </p>
        </div>
      </div>

      {mode === "edit" ? (
        <div className="flex items-start gap-3">
          <Checkbox
            id={isActiveId}
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(checked === true)}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={isActiveId}>Aktif</Label>
            <p className="text-sm text-muted-foreground">
              Hilangkan tanda untuk menjeda transaksi berulang ini.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={merchantId}>Toko</Label>
        <Input
          id={merchantId}
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="h-11"
          placeholder="Opsional, misal: Netflix"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={descriptionId}>Catatan</Label>
        <Input
          id={descriptionId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          <Link href="/recurring">Batal</Link>
        </Button>
      </div>
    </form>
  );
}
