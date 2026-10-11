"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isTransactionType } from "@/lib/transactions";

export interface TransactionFormInput {
  transaction_type: string;
  amount: number;
  account_id: string;
  destination_account_id?: string | null;
  category_id?: string | null;
  transaction_at: string;
  description?: string | null;
  merchant?: string | null;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

// Shared server-side validation. Mirrors the client-side checks in the
// transaction form so a tampered or scripted request is still rejected before
// touching the DB. The amount stays unscaled (plain IDR number).
function validate(input: TransactionFormInput): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (
    typeof input.amount !== "number" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    fieldErrors.amount = "Nominal harus berupa angka lebih dari nol.";
  }

  if (!input.account_id || input.account_id.trim().length === 0) {
    fieldErrors.account_id = "Pilih rekening sumber.";
  }

  if (!input.transaction_type || !isTransactionType(input.transaction_type)) {
    fieldErrors.transaction_type = "Pilih jenis transaksi yang tersedia.";
  }

  if (
    input.transaction_type === "income" ||
    input.transaction_type === "expense"
  ) {
    if (!input.category_id || input.category_id.trim().length === 0) {
      fieldErrors.category_id = "Pilih kategori transaksi.";
    }
  }

  if (input.transaction_type === "transfer") {
    if (
      !input.destination_account_id ||
      input.destination_account_id.trim().length === 0
    ) {
      fieldErrors.destination_account_id = "Pilih rekening tujuan.";
    } else if (input.destination_account_id === input.account_id) {
      fieldErrors.destination_account_id =
        "Rekening tujuan harus berbeda dari rekening sumber.";
    }
  }

  return fieldErrors;
}

// Confirms the account belongs to the user and is not archived. Returns false
// on any lookup failure so we fail closed rather than trusting RLS alone.
async function ownsActiveAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("id", accountId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

// Confirms the category is usable for the user: their own or a shared system
// category, non-archived, matching the transaction direction.
async function canUseCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string,
  type: "income" | "expense",
): Promise<boolean> {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("is_archived", false)
    .eq("category_type", type)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

// Runs validation plus the DB-backed ownership checks shared by create/update.
// Returns an ActionResult error when anything fails, or null when the payload
// is safe to write.
async function guardTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: TransactionFormInput,
): Promise<Exclude<ActionResult, { ok: true }> | null> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  if (!(await ownsActiveAccount(supabase, userId, input.account_id))) {
    return {
      ok: false,
      message: "Rekening sumber tidak ditemukan.",
      fieldErrors: { account_id: "Rekening sumber tidak tersedia." },
    };
  }

  if (input.transaction_type === "transfer") {
    const destination = input.destination_account_id ?? "";
    if (!(await ownsActiveAccount(supabase, userId, destination))) {
      return {
        ok: false,
        message: "Rekening tujuan tidak ditemukan.",
        fieldErrors: { destination_account_id: "Rekening tujuan tidak tersedia." },
      };
    }
  }

  if (
    input.transaction_type === "income" ||
    input.transaction_type === "expense"
  ) {
    const categoryId = input.category_id ?? "";
    if (
      !(await canUseCategory(
        supabase,
        userId,
        categoryId,
        input.transaction_type,
      ))
    ) {
      return {
        ok: false,
        message: "Kategori tidak tersedia.",
        fieldErrors: { category_id: "Kategori tidak tersedia." },
      };
    }
  }

  return null;
}

// Builds the insert/update payload. Transfers carry a destination and no
// category; income/expense carry a category and no destination. Money is stored
// unscaled and currency is always IDR.
function buildPayload(userId: string, input: TransactionFormInput) {
  const isTransfer = input.transaction_type === "transfer";

  return {
    user_id: userId,
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
    source: "manual",
    source_reference: null,
  };
}

export async function createTransaction(
  input: TransactionFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const guard = await guardTransaction(supabase, user.id, input);
  if (guard) return guard;

  const { error } = await supabase
    .from("transactions")
    .insert(buildPayload(user.id, input));

  if (error) {
    // Surface the DB error gracefully (e.g. an unexpected CHECK constraint on
    // transaction_type). We do not alter the schema here.
    return {
      ok: false,
      message: "Transaksi gagal disimpan. Silakan coba lagi.",
    };
  }

  revalidatePath("/transactions");
  return { ok: true };
}

export async function updateTransaction(
  id: string,
  input: TransactionFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const guard = await guardTransaction(supabase, user.id, input);
  if (guard) return guard;

  const { error } = await supabase
    .from("transactions")
    .update(buildPayload(user.id, input))
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: "Perubahan gagal disimpan. Silakan coba lagi.",
    };
  }

  revalidatePath("/transactions");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: "Transaksi gagal dihapus. Silakan coba lagi.",
    };
  }

  revalidatePath("/transactions");
  return { ok: true };
}
