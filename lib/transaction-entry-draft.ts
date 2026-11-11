import type { TransactionRow } from "./transactions";
import { isValidTransactionIdrAmount } from "./idr-money.ts";
import { transactionAmountInputFromValue } from "./transaction-amount-input.ts";

/** Temporary, per-tab form state while moving to the category / duplicate pages.
 * Never includes credentials, source_reference, IDs of Gmail drafts, or writes
 * to the transaction ledger. The user must still explicitly save the form. */
export const ENTRY_DRAFT_KEY = "budgetku:transaction-entry-nav:v1";

export interface TransactionEntryDraft {
  transactionType: "expense" | "income" | "transfer";
  amountInput: string;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  categoryName: string;
  transactionAt: string;
  merchant: string;
  description: string;
  recurring: boolean;
  frequency: string;
  indefinite: boolean;
  endDate: string;
}

export function todayEntryDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftEntryDate(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultEntryDraft(accountId = "", now = new Date()): TransactionEntryDraft {
  return {
    transactionType: "expense", amountInput: "0", accountId,
    destinationAccountId: "", categoryId: "", categoryName: "",
    transactionAt: todayEntryDate(now), merchant: "", description: "",
    recurring: false, frequency: "monthly", indefinite: true, endDate: "",
  };
}

type DuplicableTransaction = Pick<TransactionRow,
  "transaction_type" | "amount" | "account_id" | "destination_account_id" |
  "category_id" | "merchant" | "description">;

/** A duplicated transaction is a new MANUAL draft, never a second DB record.
 * Do not copy transaction ID, source, source_reference or original date.
 * Non-active accounts/categories are cleared, then reselected by the user. */
export function draftFromTransaction(
  row: DuplicableTransaction,
  activeAccountIds: readonly string[],
  allowedCategoryIds: readonly string[],
  now = new Date(),
): TransactionEntryDraft {
  const draft = defaultEntryDraft("", now);
  draft.transactionType =
    row.transaction_type === "expense" ||
    row.transaction_type === "income" ||
    row.transaction_type === "transfer"
      ? row.transaction_type : "expense";
  draft.amountInput = isValidTransactionIdrAmount(Number(row.amount))
    ? transactionAmountInputFromValue(Number(row.amount)) : "0";
  draft.accountId = activeAccountIds.includes(row.account_id) ? row.account_id : "";
  draft.destinationAccountId = row.destination_account_id &&
    activeAccountIds.includes(row.destination_account_id) &&
    row.destination_account_id !== draft.accountId
      ? row.destination_account_id : "";
  draft.categoryId = row.category_id && allowedCategoryIds.includes(row.category_id)
    ? row.category_id : "";
  if (draft.transactionType === "transfer") draft.categoryId = "";
  else draft.destinationAccountId = "";
  draft.merchant = (row.merchant ?? "").slice(0, 255);
  draft.description = (row.description ?? "").slice(0, 2000);
  return draft;
}

export function isEntryDraft(value: unknown): value is TransactionEntryDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Partial<TransactionEntryDraft>;
  return (
    (v.transactionType === "expense" || v.transactionType === "income" || v.transactionType === "transfer") &&
    typeof v.amountInput === "string" && v.amountInput.length <= 30 &&
    typeof v.accountId === "string" &&
    typeof v.destinationAccountId === "string" &&
    typeof v.categoryId === "string" &&
    typeof v.categoryName === "string" &&
    typeof v.transactionAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.transactionAt) &&
    typeof v.merchant === "string" && typeof v.description === "string" &&
    typeof v.recurring === "boolean" && typeof v.frequency === "string" &&
    typeof v.indefinite === "boolean" && typeof v.endDate === "string"
  );
}

export function saveEntryDraft(draft: TransactionEntryDraft): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(ENTRY_DRAFT_KEY, JSON.stringify(draft)); } catch { /* Private mode quota */ }
}
export function readEntryDraft(): TransactionEntryDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ENTRY_DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isEntryDraft(parsed) ? parsed : null;
  } catch { return null; }
}
export function clearEntryDraft(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(ENTRY_DRAFT_KEY); } catch { /* Private mode */ }
}
