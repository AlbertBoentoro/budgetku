"use server";

import { revalidatePath } from "next/cache";

import { createOAuthClient } from "@/lib/gmail/oauth";
import { decryptSecret } from "@/lib/crypto";
import { syncGmail as runSync } from "@/lib/gmail/sync";
import { createClient } from "@/lib/supabase/server";
import { isTransactionType } from "@/lib/transactions";

/**
 * Server actions for Gmail import (design §4.3–§4.6). All getUser()-gated and
 * `.eq("user_id", user.id)`-scoped (fail-closed; RLS is only the backstop).
 * importDraft derives source/source_reference/currency/user_id server-side and
 * runs the SAME validate() rules + exact copy as transactions/actions.ts.
 * No secret value is ever returned to the client or logged.
 */

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

// Exactly the contract from design §4.4 — no client-supplied source_reference,
// user_id, or transaction_id. transfer is rejected (Gmail drafts are
// income/expense only).
export interface ImportDraftInput {
  importId: string;
  transaction_type: "income" | "expense";
  amount: number;
  account_id: string;
  category_id: string;
  transaction_at: string;
  description?: string | null;
  merchant?: string | null;
}

// Matches a canonical "YYYY-MM-DD" and confirms it is a real calendar date.
// Mirrors isValidDateString in transactions/actions.ts (not exported there).
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

// Shared server-side validation. Reuses the EXACT rules and Indonesian copy
// from transactions/actions.ts validate() for the fields a Gmail draft carries.
// transfer is rejected because a draft is always income/expense.
function validateDraft(input: ImportDraftInput): Record<string, string> {
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

  // Treat transaction_type as a raw string so a tampered/scripted request
  // (e.g. "transfer" or an unknown value) is still rejected at runtime, even
  // though the typed contract only permits income/expense.
  const rawType: string = input.transaction_type;
  const isIncomeOrExpense = rawType === "income" || rawType === "expense";
  if (!rawType || !isTransactionType(rawType) || !isIncomeOrExpense) {
    fieldErrors.transaction_type = "Pilih jenis transaksi yang tersedia.";
  }

  if (isIncomeOrExpense) {
    if (!input.category_id || input.category_id.trim().length === 0) {
      fieldErrors.category_id = "Pilih kategori transaksi.";
    }
  }

  if (!input.transaction_at || !isValidDateString(input.transaction_at)) {
    fieldErrors.transaction_at = "Pilih tanggal transaksi yang valid.";
  }

  return fieldErrors;
}

// Confirms the account belongs to the user and is not archived. Fail-closed:
// any lookup failure returns false. Mirrors ownsActiveAccount in
// transactions/actions.ts.
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

// Confirms the category is usable: the user's own or a shared system category,
// non-archived, matching the direction. Mirrors canUseCategory in
// transactions/actions.ts.
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

/**
 * syncGmail — manual "Sync sekarang" trigger (§4.3). Loads the connected
 * connection, runs the sync engine, and returns an honest ActionResult with NO
 * fabricated counts in copy.
 */
export async function syncGmail(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { data: connection, error: connError } = await supabase
    .from("email_connections")
    .select("id, status, sync_cursor")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connError) {
    return { ok: false, message: "Gagal memuat koneksi Gmail. Coba lagi." };
  }
  if (!connection) {
    return { ok: false, message: "Belum ada koneksi Gmail. Hubungkan dulu." };
  }
  if (connection.status !== "active") {
    return {
      ok: false,
      message: "Koneksi Gmail tidak aktif. Hubungkan ulang untuk melanjutkan.",
    };
  }

  try {
    await runSync(supabase, user.id, {
      id: connection.id,
      sync_cursor: connection.sync_cursor,
    });
  } catch {
    return {
      ok: false,
      message: "Sinkronisasi Gmail gagal. Coba lagi sebentar lagi.",
    };
  }

  revalidatePath("/settings/gmail");
  return { ok: true };
}

/**
 * importDraft — confirm a reviewed draft into a real transactions row (§4.4).
 * Derives source/source_reference/currency/user_id server-side; runs the shared
 * validate() rules + ownership checks; the idempotency guard rejects an
 * already-imported row (backstop against double transactions until BLOCKER-3).
 */
export async function importDraft(
  input: ImportDraftInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const fieldErrors = validateDraft(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Periksa kembali isian formulir.",
      fieldErrors,
    };
  }

  // Load the import row scoped to the user. Idempotency guard: a missing row,
  // an already-imported status, or an already-set transaction_id blocks a
  // second insert.
  const { data: importRow, error: importError } = await supabase
    .from("email_imports")
    .select("id, gmail_message_id, status, transaction_id")
    .eq("id", input.importId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (importError) {
    return { ok: false, message: "Gagal memuat email impor. Coba lagi." };
  }
  if (
    !importRow ||
    importRow.status === "imported" ||
    importRow.transaction_id !== null
  ) {
    return {
      ok: false,
      message: "Email ini sudah diimpor sebelumnya.",
    };
  }

  // Ownership checks exactly as guardTransaction, fail-closed.
  if (!(await ownsActiveAccount(supabase, user.id, input.account_id))) {
    return {
      ok: false,
      message: "Rekening sumber tidak ditemukan.",
      fieldErrors: { account_id: "Rekening sumber tidak tersedia." },
    };
  }

  if (
    !(await canUseCategory(
      supabase,
      user.id,
      input.category_id,
      input.transaction_type,
    ))
  ) {
    return {
      ok: false,
      message: "Kategori tidak tersedia.",
      fieldErrors: { category_id: "Kategori tidak tersedia." },
    };
  }

  // Insert the transaction. source/source_reference/currency/user_id are all
  // derived server-side; source_reference comes from the LOADED row, never input.
  const { data: created, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: input.account_id,
      destination_account_id: null,
      category_id: input.category_id,
      transaction_type: input.transaction_type,
      amount: input.amount,
      currency: "IDR",
      transaction_at: input.transaction_at,
      description: input.description ?? null,
      merchant: input.merchant ?? null,
      source: "email",
      source_reference: importRow.gmail_message_id,
    })
    .select("id")
    .single();

  if (txError || !created) {
    return {
      ok: false,
      message: "Transaksi gagal disimpan. Silakan coba lagi.",
    };
  }

  // Link the import row to the new transaction.
  const { error: linkError } = await supabase
    .from("email_imports")
    .update({
      transaction_id: created.id,
      status: "imported",
      processed_at: new Date().toISOString(),
    })
    .eq("id", importRow.id)
    .eq("user_id", user.id);

  if (linkError) {
    // Honest partial-failure message, matching createTransaction's recurring
    // partial-failure pattern. The transaction was saved.
    revalidatePath("/settings/gmail");
    revalidatePath("/transactions");
    return {
      ok: false,
      message:
        "Transaksi tersimpan, tetapi status email gagal diperbarui. Coba sinkronkan lagi.",
    };
  }

  revalidatePath("/settings/gmail");
  revalidatePath("/transactions");
  return { ok: true };
}

/**
 * ignoreImport — dismiss a draft (§4.5). Idempotent, user-scoped: set status
 * 'ignored' + processed_at. An already-imported row is left untouched.
 */
export async function ignoreImport(importId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { data: importRow, error: importError } = await supabase
    .from("email_imports")
    .select("id, status")
    .eq("id", importId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (importError) {
    return { ok: false, message: "Gagal memuat email impor. Coba lagi." };
  }
  if (!importRow) {
    return { ok: false, message: "Email impor tidak ditemukan." };
  }
  // Idempotent: an imported row is never flipped to ignored.
  if (importRow.status === "imported") {
    return {
      ok: false,
      message: "Email ini sudah diimpor dan tidak bisa diabaikan.",
    };
  }
  if (importRow.status === "skipped") {
    revalidatePath("/settings/gmail");
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("email_imports")
    .update({ status: "skipped", processed_at: new Date().toISOString() })
    .eq("id", importRow.id)
    .eq("user_id", user.id);

  if (updateError) {
    return { ok: false, message: "Gagal mengabaikan email. Coba lagi." };
  }

  revalidatePath("/settings/gmail");
  return { ok: true };
}

/**
 * disconnectGmail — revoke + strip tokens, KEEP the connection row (§4.6, the
 * disconnect-keeps-the-row decision). Best-effort revoke at Google; delete the
 * secret; set the connection to 'disconnected' so the email_imports FK stays
 * valid and import history is preserved.
 */
export async function disconnectGmail(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { data: connection, error: connError } = await supabase
    .from("email_connections")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connError) {
    return { ok: false, message: "Gagal memuat koneksi Gmail. Coba lagi." };
  }
  if (!connection) {
    revalidatePath("/settings/gmail");
    return { ok: true };
  }

  // Best-effort revoke at Google using the decrypted refresh token; ignore any
  // failure (the token may already be revoked/expired). The decrypted token
  // exists only in server memory here and is never logged or returned.
  const { data: secret } = await supabase
    .from("email_connection_secrets")
    .select("refresh_token")
    .eq("user_id", user.id)
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (secret?.refresh_token) {
    try {
      const refreshToken = decryptSecret(secret.refresh_token);
      const oauthClient = createOAuthClient();
      await oauthClient.revokeToken(refreshToken);
    } catch {
      // Ignore: revoke is best-effort and must not block disconnect.
    }
  }

  // Delete the only copy of the encrypted tokens.
  const { error: deleteError } = await supabase
    .from("email_connection_secrets")
    .delete()
    .eq("user_id", user.id)
    .eq("connection_id", connection.id);

  if (deleteError) {
    return { ok: false, message: "Gagal memutus koneksi Gmail. Coba lagi." };
  }

  // Keep the connection row (disconnect-keeps-the-row): clear its cursor/error
  // and mark it disconnected so the email_imports FK stays valid and history is
  // preserved for a later reconnect.
  const { error: updateError } = await supabase
    .from("email_connections")
    .update({
      status: "disconnected",
      last_error: null,
      sync_cursor: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .eq("user_id", user.id);

  if (updateError) {
    return { ok: false, message: "Gagal memutus koneksi Gmail. Coba lagi." };
  }

  revalidatePath("/settings/gmail");
  return { ok: true };
}
