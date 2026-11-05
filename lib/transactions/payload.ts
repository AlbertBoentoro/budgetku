// Row payloads for the manual transaction form (create and edit).
//
// Provenance (`source`, `source_reference`) records where a row came from:
// "manual", a Gmail import ("email" + message id), or a recurring schedule
// ("recurring" + "<template>:<date>", or "manual" + "initial-recurring:<key>").
// Gmail reconciliation and the recurring duplicate guard look rows up by it,
// so an edit must never change it. Only a new manual row sets it, and form
// input can never supply it.
//
// No imports on purpose, so the builders can be unit-tested in plain Node.

export interface TransactionPayloadInput {
  transaction_type: string;
  amount: number;
  account_id: string;
  destination_account_id?: string | null;
  category_id?: string | null;
  transaction_at: string;
  description?: string | null;
  merchant?: string | null;
}

// The fields the form is allowed to edit. Transfers carry a destination and no
// category; income/expense carry a category and no destination. Money is
// stored unscaled and currency is always IDR.
function editableFields(input: TransactionPayloadInput) {
  const isTransfer = input.transaction_type === "transfer";
  return {
    account_id: input.account_id,
    destination_account_id: isTransfer
      ? input.destination_account_id ?? null
      : null,
    category_id: isTransfer ? null : input.category_id ?? null,
    transaction_type: input.transaction_type,
    amount: input.amount,
    currency: "IDR",
    transaction_at: input.transaction_at,
    description: input.description ?? null,
    merchant: input.merchant ?? null,
  };
}

// A new row created from the form is a manual transaction.
export function buildTransactionInsertPayload(
  userId: string,
  input: TransactionPayloadInput,
) {
  return {
    user_id: userId,
    ...editableFields(input),
    source: "manual",
    source_reference: null,
  };
}

// An edit changes only the editable fields. It leaves `source`,
// `source_reference`, and `user_id` of the stored row untouched; the caller
// still scopes the update by id and user_id.
export function buildTransactionUpdatePayload(input: TransactionPayloadInput) {
  return editableFields(input);
}
