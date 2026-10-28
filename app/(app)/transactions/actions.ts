"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isTransactionType } from "@/lib/transactions";
import { computeNextDueDate, isFrequency } from "@/lib/recurring";

export interface TransactionFormInput {
  transaction_type: string;
  amount: number;
  account_id: string;
  destination_account_id?: string | null;
  category_id?: string | null;
  transaction_at: string;
  description?: string | null;
  merchant?: string | null;
  // Recurrence is opt-in from the create form via a checkbox. When `recurring`
  // is true, a recurring_transactions template is created alongside the normal
  // transaction. These fields are ignored on update.
  recurring?: boolean;
  frequency?: string | null;
  interval_count?: number | null;
  // Recurrence end date (YYYY-MM-DD). Only meaningful when `recurring` is true
  // and `recurring_indefinite` is false. When indefinite is true the schedule
  // has no end and this is stored as null.
  end_date?: string | null;
  recurring_indefinite?: boolean;
}

// Matches a canonical "YYYY-MM-DD" and confirms it is a real calendar date (so
// "2026-13-40" is rejected). Mirrors the recurring/goals action validators.
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

// Normalizes a transaction_at (ISO timestamp or plain date) to a date-only
// "YYYY-MM-DD" string so the recurring template's start/next-due math stays on
// the same UTC date-only basis as lib/recurring.ts.
function toDateOnly(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
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

  // The form always sends a date-only "YYYY-MM-DD"; reject anything else so a
  // tampered request cannot store an arbitrary timestamp. Same rule and copy
  // as importDraft in settings/gmail/actions.ts.
  if (!input.transaction_at || !isValidDateString(input.transaction_at)) {
    fieldErrors.transaction_at = "Pilih tanggal transaksi yang valid.";
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

  // Recurrence validation only runs when the user ticked "Transaksi berulang".
  // The transaction's own date (transaction_at) is the recurrence start.
  if (input.recurring) {
    if (!input.frequency || !isFrequency(input.frequency)) {
      fieldErrors.frequency = "Pilih frekuensi yang tersedia.";
    }

    // The schedule is open-ended when "Sampai waktu yang tidak ditentukan" is
    // checked; only a bounded schedule (indefinite === false) needs an end
    // date, and it must not fall before the start date.
    if (input.recurring_indefinite === false) {
      const start = toDateOnly(input.transaction_at);
      if (!input.end_date) {
        fieldErrors.end_date = "Tanggal berakhir wajib diisi.";
      } else if (!isValidDateString(input.end_date)) {
        fieldErrors.end_date = "Tanggal berakhir tidak valid.";
      } else if (isValidDateString(start) && input.end_date < start) {
        fieldErrors.end_date =
          "Tanggal berakhir tidak boleh sebelum tanggal transaksi.";
      }
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

// Resolves a category's display name for the recurring template fallback name.
// Returns null on any failure so name derivation falls through to the generic
// label rather than throwing.
async function fetchCategoryName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .maybeSingle();

  if (error || !data) return null;
  return data.name;
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

  // When "Transaksi berulang" was ticked, also create one recurring template.
  // The transaction above is already recorded for the picked date, so the
  // template's start_date is that date and next_due_date is the occurrence
  // AFTER it. interval_count is fixed at 1 (the form offers no interval field);
  // auto_create is false because no scheduler exists (occurrences are recorded
  // manually from the Transaksi berulang page).
  if (input.recurring) {
    const isTransfer = input.transaction_type === "transfer";
    const start = toDateOnly(input.transaction_at);
    const frequency = input.frequency ?? "";
    const now = new Date().toISOString();

    // Name derivation (no fabricated data): description -> merchant -> category
    // name -> a generic honest label. The user can rename later from the list.
    const trimmedDescription = input.description?.trim();
    const trimmedMerchant = input.merchant?.trim();
    let name = trimmedDescription || trimmedMerchant || "";
    if (!name && !isTransfer && input.category_id) {
      const categoryName = await fetchCategoryName(
        supabase,
        user.id,
        input.category_id,
      );
      if (categoryName) name = categoryName;
    }
    if (!name) name = "Transaksi berulang";

    const { error: recurringError } = await supabase
      .from("recurring_transactions")
      .insert({
        user_id: user.id,
        name,
        account_id: input.account_id,
        destination_account_id: isTransfer
          ? input.destination_account_id ?? null
          : null,
        category_id: isTransfer ? null : input.category_id ?? null,
        transaction_type: input.transaction_type,
        amount: input.amount,
        frequency,
        interval_count: 1,
        start_date: start,
        // Indefinite recurrence stores null (the user ends it later by pausing
        // or deleting from the Transaksi berulang page). A bounded schedule
        // stores the picked end date. The DB end_date column is unchanged.
        end_date:
          input.recurring_indefinite === false && input.end_date
            ? toDateOnly(input.end_date)
            : null,
        next_due_date: computeNextDueDate(frequency, 1, start),
        last_generated_at: now,
        auto_create: false,
        is_active: true,
        description: trimmedDescription ? trimmedDescription : null,
        merchant: trimmedMerchant ? trimmedMerchant : null,
      });

    if (recurringError) {
      // The transaction was saved; only the recurring template failed (e.g. an
      // unexpected CHECK constraint). We do not alter the schema here, we report
      // honestly so the user can retry creating the schedule from /recurring.
      revalidatePath("/transactions");
      revalidatePath("/recurring");
      return {
        ok: false,
        message:
          "Transaksi tersimpan, tetapi jadwal berulang gagal dibuat. Coba buat jadwalnya lagi.",
      };
    }
  }

  revalidatePath("/transactions");
  if (input.recurring) revalidatePath("/recurring");
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
