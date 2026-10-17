"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  TRANSACTION_TYPES,
  parseIdrInput,
  type AccountRow,
  type CategoryRow,
} from "@/lib/transactions";
import {
  importDraft,
  type ActionResult,
} from "@/app/(app)/settings/gmail/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Re-declared identically to the string in components/finance/transaction-form.tsx
// (the source of truth for native-select styling). Kept local to avoid editing
// the transaction form; if these ever diverge, update both (design §9).
const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

// Gmail drafts are income/expense only (a transfer needs two owned accounts the
// email cannot reliably identify). Transfer is filtered out here and rejected
// server-side.
const DRAFT_TYPES = TRANSACTION_TYPES.filter(
  (t) => t.value === "income" || t.value === "expense",
);

const idrPreview = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// The re-parsed, display-only candidate values for one opened draft. Any field
// may be null (not detected); nothing here is fabricated or persisted.
export interface DraftCandidate {
  amount: number | null;
  direction: "income" | "expense" | null;
  transactionAt: string | null;
  merchant: string | null;
  description: string | null;
  confidence: "high" | "low";
}

interface GmailImportReviewProps {
  importId: string;
  candidate: DraftCandidate;
  accounts: AccountRow[];
  incomeCategories: CategoryRow[];
  expenseCategories: CategoryRow[];
  // Fallback date (the email's received date, YYYY-MM-DD) when no date was
  // detected, so the form always starts from an honest, editable default.
  receivedDate: string;
  onCancel: () => void;
}

type FieldErrors = Partial<
  Record<"amount" | "account_id" | "category_id" | "transaction_at", string>
>;

/**
 * Per-draft review form (design decision option b). Reuses the shared
 * primitives (parseIdrInput, TRANSACTION_TYPES, selectClassName, Input/Label/
 * Button) and the VERBATIM validation copy from transaction-form.tsx. Detected
 * values are labeled as detected and are fully editable; the user picks
 * account/category and may correct amount/type/date before saving. The primary
 * button "Simpan transaksi" calls importDraft.
 */
export function GmailImportReview({
  importId,
  candidate,
  accounts,
  incomeCategories,
  expenseCategories,
  receivedDate,
  onCancel,
}: GmailImportReviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Detected direction pre-fills type; default to expense (the common case) so
  // the user still consciously confirms it.
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    candidate.direction ?? "expense",
  );
  const [amountInput, setAmountInput] = useState(
    candidate.amount !== null ? String(candidate.amount) : "",
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [transactionAt, setTransactionAt] = useState(
    candidate.transactionAt ?? receivedDate,
  );
  const [merchant, setMerchant] = useState(candidate.merchant ?? "");
  const [description, setDescription] = useState(candidate.description ?? "");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const typeLabelId = useId();
  const amountId = useId();
  const amountErrId = useId();
  const accountFieldId = useId();
  const accountErrId = useId();
  const categoryFieldId = useId();
  const categoryErrId = useId();
  const dateId = useId();
  const dateErrId = useId();
  const merchantId = useId();
  const descriptionId = useId();

  const categoryOptions =
    transactionType === "income" ? incomeCategories : expenseCategories;

  const parsedAmount = useMemo(() => parseIdrInput(amountInput), [amountInput]);
  const amountPreview =
    amountInput.trim() === "" || parsedAmount === null
      ? null
      : idrPreview.format(parsedAmount);

  function handleTypeChange(nextType: "income" | "expense") {
    setTransactionType(nextType);
    // Category options depend on direction; clear a now-invalid pick.
    setCategoryId("");
    setFieldErrors((prev) => ({ ...prev, category_id: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Client-side validation mirroring validateDraft in actions.ts, with the
    // EXACT shared copy; the server re-checks everything.
    const errors: FieldErrors = {};
    const amount = parseIdrInput(amountInput);
    if (amount === null || amount <= 0) {
      errors.amount = "Nominal harus berupa angka lebih dari nol.";
    }
    if (!accountId) {
      errors.account_id = "Pilih rekening sumber.";
    }
    if (!categoryId) {
      errors.category_id = "Pilih kategori transaksi.";
    }
    if (!transactionAt) {
      errors.transaction_at = "Pilih tanggal transaksi yang valid.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || amount === null) return;

    const trimmedMerchant = merchant.trim();
    const trimmedDescription = description.trim();

    startTransition(async () => {
      const result: ActionResult = await importDraft({
        importId,
        transaction_type: transactionType,
        amount,
        account_id: accountId,
        category_id: categoryId,
        transaction_at: transactionAt,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        merchant: trimmedMerchant.length > 0 ? trimmedMerchant : null,
      });
      if (result.ok) {
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-md border border-input bg-muted/20 p-4"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Tinjau transaksi</h3>
        <p className="text-sm text-muted-foreground">
          Nilai di bawah terdeteksi dari email dan bisa kamu ubah. Pilih rekening
          dan kategori sebelum menyimpan.
          {candidate.confidence === "low"
            ? " Deteksi untuk email ini kurang yakin, periksa dengan teliti."
            : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span id={typeLabelId} className="text-sm font-medium">
          Jenis transaksi
        </span>
        <div
          role="group"
          aria-labelledby={typeLabelId}
          className="grid grid-cols-2 gap-2"
        >
          {DRAFT_TYPES.map((type) => {
            const selected = transactionType === type.value;
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  handleTypeChange(type.value as "income" | "expense")
                }
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Nominal tidak terdeteksi dari email. Isi manual.
          </p>
        )}
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
          onChange={(e) => setAccountId(e.target.value)}
          aria-invalid={fieldErrors.account_id ? true : undefined}
          aria-describedby={fieldErrors.account_id ? accountErrId : undefined}
          className={cn(selectClassName)}
        >
          <option value="">Pilih rekening</option>
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={dateId}>Tanggal</Label>
        <Input
          id={dateId}
          type="date"
          value={transactionAt}
          onChange={(e) => setTransactionAt(e.target.value)}
          className="h-11"
          aria-invalid={fieldErrors.transaction_at ? true : undefined}
          aria-describedby={
            fieldErrors.transaction_at ? dateErrId : undefined
          }
        />
        {fieldErrors.transaction_at ? (
          <p id={dateErrId} role="alert" className="text-sm text-destructive">
            {fieldErrors.transaction_at}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={merchantId}>Toko</Label>
        <Input
          id={merchantId}
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="h-11"
          placeholder="Opsional"
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
          {isPending ? "Menyimpan..." : "Simpan transaksi"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={onCancel}
          disabled={isPending}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
