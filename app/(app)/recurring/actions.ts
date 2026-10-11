"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  computeNextDueDate,
  isFrequency,
  isTransactionType,
  type RecurringRow,
} from "@/lib/recurring";

export interface RecurringFormInput {
  name: string;
  transaction_type: string;
  amount: number;
  account_id: string;
  destination_account_id?: string | null;
  category_id?: string | null;
  frequency: string;
  interval_count: number;
  start_date: string;
  end_date?: string | null;
  next_due_date?: string | null;
  auto_create: boolean;
  is_active: boolean;
  description?: string | null;
  merchant?: string | null;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Matches a canonical "YYYY-MM-DD" and confirms it is a real calendar date (so
// "2026-13-40" is rejected). Mirrors the goals action validator.
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

// Shared server-side validation. Mirrors the client-side checks in the
// recurring form so a tampered or scripted request is rejected before touching
// the DB. The amount stays unscaled (plain IDR number).
function validate(input: RecurringFormInput): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    fieldErrors.name = "Nama transaksi berulang wajib diisi.";
  }

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

  if (!input.frequency || !isFrequency(input.frequency)) {
    fieldErrors.frequency = "Pilih frekuensi yang tersedia.";
  }

  if (
    typeof input.interval_count !== "number" ||
    !Number.isInteger(input.interval_count) ||
    input.interval_count < 1
  ) {
    fieldErrors.interval_count = "Interval minimal 1.";
  }

  if (!input.start_date || !isValidDateString(input.start_date)) {
    fieldErrors.start_date = "Tanggal mulai tidak valid.";
  }

  if (input.end_date) {
    if (!isValidDateString(input.end_date)) {
      fieldErrors.end_date = "Tanggal berakhir tidak valid.";
    } else if (
      isValidDateString(input.start_date) &&
      input.end_date < input.start_date
    ) {
      fieldErrors.end_date =
        "Tanggal berakhir tidak boleh sebelum tanggal mulai.";
    }
  }

  if (input.next_due_date && !isValidDateString(input.next_due_date)) {
    fieldErrors.next_due_date = "Tanggal jatuh tempo tidak valid.";
  }

  return fieldErrors;
}

// Confirms the account belongs to the user and is not archived. Returns false
// on any lookup failure so we fail closed rather than trusting RLS alone.
async function ownsActiveAccount(
  supabase: ServerSupabaseClient,
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
  supabase: ServerSupabaseClient,
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

// Loads a template the user owns. Returns null on any failure so callers fail
// closed (used by edit/toggle/delete/generate).
async function fetchOwnedTemplate(
  supabase: ServerSupabaseClient,
  userId: string,
  id: string,
): Promise<RecurringRow | null> {
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RecurringRow;
}

// Runs validation plus the DB-backed ownership checks shared by create/update.
// Returns an ActionResult error when anything fails, or null when the payload
// is safe to write.
async function guardRecurring(
  supabase: ServerSupabaseClient,
  userId: string,
  input: RecurringFormInput,
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
// category; income/expense carry a category and no destination. next_due_date
// falls back to start_date (the first occurrence is the start date). Money is
// stored unscaled.
function buildPayload(userId: string, input: RecurringFormInput) {
  const isTransfer = input.transaction_type === "transfer";
  const nextDue =
    input.next_due_date && input.next_due_date.trim().length > 0
      ? input.next_due_date
      : input.start_date;

  const trimmedDescription = input.description?.trim();
  const trimmedMerchant = input.merchant?.trim();

  return {
    user_id: userId,
    name: input.name.trim(),
    account_id: input.account_id,
    destination_account_id: isTransfer
      ? input.destination_account_id ?? null
      : null,
    category_id: isTransfer ? null : input.category_id ?? null,
    transaction_type: input.transaction_type,
    amount: input.amount,
    frequency: input.frequency,
    interval_count: input.interval_count,
    start_date: input.start_date,
    end_date: input.end_date ? input.end_date : null,
    next_due_date: nextDue,
    auto_create: Boolean(input.auto_create),
    is_active: Boolean(input.is_active),
    description: trimmedDescription ? trimmedDescription : null,
    merchant: trimmedMerchant ? trimmedMerchant : null,
  };
}

export async function createRecurring(
  input: RecurringFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const guard = await guardRecurring(supabase, user.id, input);
  if (guard) return guard;

  const { error } = await supabase
    .from("recurring_transactions")
    .insert(buildPayload(user.id, input));

  if (error) {
    // Surface the DB error gracefully (e.g. an unexpected CHECK constraint on
    // transaction_type or frequency). We do not alter the schema here.
    return {
      ok: false,
      message: "Transaksi berulang gagal disimpan. Silakan coba lagi.",
    };
  }

  revalidatePath("/recurring");
  return { ok: true };
}

export async function updateRecurring(
  id: string,
  input: RecurringFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const guard = await guardRecurring(supabase, user.id, input);
  if (guard) return guard;

  const { error } = await supabase
    .from("recurring_transactions")
    .update(buildPayload(user.id, input))
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: "Perubahan gagal disimpan. Silakan coba lagi.",
    };
  }

  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}/edit`);
  return { ok: true };
}

// Pause/resume (Jeda/Lanjutkan). Scoped by id AND user_id.
export async function setRecurringActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { error } = await supabase
    .from("recurring_transactions")
    .update({ is_active: Boolean(isActive) })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: "Status transaksi berulang gagal diubah. Silakan coba lagi.",
    };
  }

  revalidatePath("/recurring");
  return { ok: true };
}

// Hard delete, scoped by id AND user_id. Deleting a template does NOT delete
// any transactions it previously generated: generated rows only tag
// source = "recurring" and have no FK back to this table, so they stay intact.
export async function deleteRecurring(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { error } = await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: "Transaksi berulang gagal dihapus. Silakan coba lagi.",
    };
  }

  revalidatePath("/recurring");
  return { ok: true };
}

// "Catat sekarang": manual generation (no cron/scheduler). Inserts one normal
// transactions row mirroring the template, then advances next_due_date and sets
// last_generated_at. If end_date has passed, nothing is generated. Every read
// and write is user-scoped with ownership checks.
export async function generateNow(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const template = await fetchOwnedTemplate(supabase, user.id, id);
  if (!template) {
    return { ok: false, message: "Transaksi berulang tidak ditemukan." };
  }

  if (!template.is_active) {
    return {
      ok: false,
      message: "Transaksi berulang sedang dijeda. Lanjutkan dulu untuk mencatat.",
    };
  }

  // If the schedule has ended, do not generate. Mark it paused so the UI stops
  // offering a due date that is past the end.
  if (template.end_date && template.next_due_date > template.end_date) {
    await supabase
      .from("recurring_transactions")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);
    revalidatePath("/recurring");
    return {
      ok: false,
      message: "Jadwal sudah melewati tanggal berakhir, tidak ada yang dicatat.",
    };
  }

  const isTransfer = template.transaction_type === "transfer";

  // Re-validate ownership of the referenced accounts/category at generate time
  // (they may have been archived since the template was created).
  if (!(await ownsActiveAccount(supabase, user.id, template.account_id))) {
    return {
      ok: false,
      message: "Rekening sumber tidak tersedia. Perbarui transaksi berulang.",
    };
  }

  if (isTransfer) {
    const destination = template.destination_account_id ?? "";
    if (!(await ownsActiveAccount(supabase, user.id, destination))) {
      return {
        ok: false,
        message: "Rekening tujuan tidak tersedia. Perbarui transaksi berulang.",
      };
    }
  } else if (
    template.transaction_type === "income" ||
    template.transaction_type === "expense"
  ) {
    const categoryId = template.category_id ?? "";
    if (
      !(await canUseCategory(
        supabase,
        user.id,
        categoryId,
        template.transaction_type,
      ))
    ) {
      return {
        ok: false,
        message: "Kategori tidak tersedia. Perbarui transaksi berulang.",
      };
    }
  }

  // Insert the generated occurrence as normal app data (anon key, RLS backstop).
  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: template.account_id,
    destination_account_id: isTransfer
      ? template.destination_account_id
      : null,
    category_id: isTransfer ? null : template.category_id,
    transaction_type: template.transaction_type,
    amount: template.amount,
    currency: "IDR",
    transaction_at: template.next_due_date,
    description: template.description,
    merchant: template.merchant,
    source: "recurring",
    source_reference: template.id,
  });

  if (insertError) {
    return {
      ok: false,
      message: "Gagal mencatat transaksi. Silakan coba lagi.",
    };
  }

  // Advance the schedule from the occurrence we just recorded.
  const advanced = computeNextDueDate(
    template.frequency,
    template.interval_count,
    template.next_due_date,
  );

  // If the next occurrence falls past end_date, pause the template so it stops
  // appearing as due.
  const shouldPause = Boolean(template.end_date && advanced > template.end_date);

  const { error: advanceError } = await supabase
    .from("recurring_transactions")
    .update({
      next_due_date: advanced,
      last_generated_at: new Date().toISOString(),
      ...(shouldPause ? { is_active: false } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (advanceError) {
    // The transaction was recorded; only the schedule advance failed. Report it
    // so the user knows the next due date may be stale.
    revalidatePath("/recurring");
    revalidatePath("/transactions");
    return {
      ok: false,
      message:
        "Transaksi tercatat, tetapi jatuh tempo berikutnya gagal diperbarui.",
    };
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions");
  return { ok: true };
}
