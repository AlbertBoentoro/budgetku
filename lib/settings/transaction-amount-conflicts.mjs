/**
 * A very conservative conflict detector: only an IDR *amount-only* edit
 * to the same manual transaction is eligible for an explicit choice.
 * Other differences (account, date, category, merchant, note, etc.) must
 * never be silently rewritten from an old backup or journal entry.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_FIELDS = [
  "id", "user_id", "account_id", "destination_account_id",
  "category_id", "transaction_type", "merchant", "description",
  "transaction_at", "currency", "source", "source_reference", "created_at",
];
function validAmount(n) {
  return Number.isSafeInteger(Number(n)) && Number(n) > 0 &&
    Number(n) <= 1_000_000_000_000;
}
function isRow(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function createAmountConflict(backup, live, userId) {
  if (!isRow(backup) || !isRow(live) || !UUID.test(userId) ||
    !UUID.test(live.id) || backup.id !== live.id ||
    live.user_id !== userId || backup.user_id !== userId ||
    backup.source !== "manual" || live.source !== "manual" ||
    backup.source_reference != null || live.source_reference != null ||
    backup.currency !== "IDR" || live.currency !== "IDR" ||
    !["income", "expense", "transfer"].includes(live.transaction_type) ||
    !validAmount(backup.amount) || !validAmount(live.amount) ||
    Number(backup.amount) === Number(live.amount) ||
    typeof live.updated_at !== "string" ||
    !Number.isFinite(Date.parse(live.updated_at))) return null;
  if (DATA_FIELDS.some(key => backup[key] !== live[key])) return null;
  return {
    id: live.id, savedAmount: Number(backup.amount),
    currentAmount: Number(live.amount), currentUpdatedAt: live.updated_at,
    transactionType: live.transaction_type,
    merchant: live.merchant ?? null, description: live.description ?? null,
    transactionAt: live.transaction_at,
    createdAt: live.created_at,
  };
}
