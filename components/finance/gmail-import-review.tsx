"use client";

import { useRouter } from "next/navigation";

import { importDraft } from "@/app/(app)/settings/gmail/actions";
import type { TransactionFormInput, ActionResult } from "@/app/(app)/transactions/actions";
import {
  TransactionForm,
  type TransactionFormInitialValues,
} from "@/components/finance/transaction-form";
import { isTransactionType, type AccountRow, type CategoryRow } from "@/lib/transactions";

// Source metadata from a saved Gmail preview is prefilled, NEVER auto-posted.
// The user can correct every field, including selecting "Transfer".
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
  receivedDate: string;
  onCancel?: () => void;
}

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
  const initialValues: TransactionFormInitialValues = {
    transaction_type: candidate.direction ?? "expense",
    amount: candidate.amount ?? 0,
    // Require explicit confirmation of account for emailed financial events.
    account_id: "",
    destination_account_id: null,
    category_id: null,
    transaction_at: candidate.transactionAt ?? receivedDate,
    merchant: candidate.merchant,
    description: candidate.description,
  };

  async function action(input: TransactionFormInput): Promise<ActionResult> {
    if (!isTransactionType(input.transaction_type)) {
      return {
        ok: false,
        message: "Pilih jenis transaksi yang tersedia.",
        fieldErrors: { transaction_type: "Jenis transaksi tidak valid." },
      };
    }
    // Gmail approval must never silently create a recurring template.
    if (input.recurring) {
      return { ok: false, message: "Impor Gmail belum mendukung transaksi berulang." };
    }
    return importDraft({
      importId,
      transaction_type: input.transaction_type,
      amount: input.amount,
      account_id: input.account_id,
      destination_account_id: input.transaction_type === "transfer"
        ? input.destination_account_id ?? null
        : null,
      category_id: input.transaction_type === "transfer" ? null : input.category_id ?? null,
      transaction_at: input.transaction_at,
      merchant: input.merchant,
      description: input.description,
    });
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-body-md font-medium text-on-surface">
          Tinjau hasil deteksi Gmail
        </p>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Isi awal diambil dari email. Pastikan jenis transaksi, nominal,
          rekening, dan kategori benar sebelum menyimpan. Belum memengaruhi saldo.
        </p>
        {candidate.confidence === "low" ? (
          <p className="mt-2 text-body-sm text-expense">
            Deteksi belum pasti. Periksa email dan cocokkan nominalnya.
          </p>
        ) : null}
        <p className="mt-2 text-body-sm text-on-surface-variant">
          Untuk transfer, pilih rekening sumber dan rekening tujuan yang berbeda.
          Transaksi berulang tetap dibuat lewat menu Catat.
        </p>
      </div>
      <TransactionForm
        key={importId}
        mode="create"
        action={action}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        initialValues={initialValues}
        currentMonth={receivedDate.slice(0, 7)}
        allowRecurring={false}
        submitText="Terima dan catat transaksi"
        onSuccess={() => router.replace("/transactions")}
        onCancel={onCancel ?? (() => router.push("/transactions"))}
      />
    </div>
  );
}
