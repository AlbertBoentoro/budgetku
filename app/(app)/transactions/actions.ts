"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isTransactionType } from "@/lib/transactions";
import {
  buildTransactionInsertPayload,
  buildTransactionUpdatePayload,
} from "@/lib/transactions/payload";
import { isFrequency } from "@/lib/recurring";
import { isValidIdrAmount } from "@/lib/idr-money";

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
  idempotency_key?: string;
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

  if (!isValidIdrAmount(input.amount)) {
    fieldErrors.amount = "Nominal harus positif dengan maksimal 2 angka desimal.";
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

  // A checked recurrence used to insert a ledger transaction first, then
  // insert its schedule in a second independent request. If step two failed,
  // retrying the form created duplicate expense/income rows. One database
  // transaction now writes both or neither, with a client idempotency key.
  if (input.recurring) {
    if (!input.idempotency_key || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.idempotency_key)) {
      return { ok: false, message: "Permintaan belum lengkap. Muat ulang formulir dan coba lagi." };
    }

    const isTransfer = input.transaction_type === "transfer";
    const trimmedDescription = input.description?.trim();
    const trimmedMerchant = input.merchant?.trim();
    let name = trimmedDescription || trimmedMerchant || "";
    if (!name && !isTransfer && input.category_id) {
      name = (await fetchCategoryName(supabase, user.id, input.category_id)) ?? "";
    }
    if (!name) name = "Transaksi berulang";

    const { error } = await supabase.rpc("create_transaction_with_recurring", {
      p_client_key: input.idempotency_key,
      p_transaction_type: input.transaction_type,
      p_amount: input.amount,
      p_account_id: input.account_id,
      p_destination_account_id: isTransfer ? input.destination_account_id ?? null : null,
      p_category_id: isTransfer ? null : input.category_id ?? null,
      p_transaction_date: input.transaction_at,
      p_description: trimmedDescription || null,
      p_merchant: trimmedMerchant || null,
      p_recurring_name: name,
      p_frequency: input.frequency ?? "",
      p_end_date: input.recurring_indefinite === false ? input.end_date ?? null : null,
    });

    if (error) {
      return {
        ok: false,
        message: error.code === "P0001"
          ? "Permintaan ini mungkin sudah pernah tercatat. Periksa transaksi sebelum mencoba dengan isian lain."
          : "Transaksi dan jadwal berulang belum tersimpan. Tidak ada pencatatan sebagian. Coba lagi.",
      };
    }

    revalidatePath("/transactions");
    revalidatePath("/recurring");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { ok: true };
  }

  const { error } = await supabase
    .from("transactions")
    .insert(buildTransactionInsertPayload(user.id, input));

  if (error) {
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
    // Provenance and owner stay as stored; see lib/transactions/payload.ts.
    .update(buildTransactionUpdatePayload(input))
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
