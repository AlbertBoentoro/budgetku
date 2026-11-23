"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { validateAccountInput } from "@/lib/account-types";
import { accountNameChanged, normalizeAccountName } from "@/lib/account-name";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { computeAccountBalances } from "@/lib/accounts";
import { openingBalanceForTarget, runningBalanceFromOpening } from "@/lib/account-balance-adjustment";

export interface AccountFormInput {
  name: string;
  account_type: string;
  // On create: opening balance. On edit: requested current balance.
  initial_balance: number;
  expected_current_balance?: number;
  color?: string | null;
  icon?: string | null;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

// Server-side validation (lib/account-types.ts) mirrors the client checks in
// AccountForm, so a tampered or scripted request is still rejected before
// touching the DB. It also returns the canonical account type to write.

const DUPLICATE_NAME_MESSAGE = "Nama rekening sudah digunakan. Gunakan nama lain.";

async function isAccountNameTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
  excludingId?: string,
): Promise<boolean> {
  // Paginate by unique id: never miss a match beyond PostgREST's row limit.
  const accounts = await fetchAllPages((from, to) =>
    supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", userId)
      .order("id")
      .range(from, to),
  );
  const normalized = normalizeAccountName(name);
  return accounts.some(
    (row) => row.id !== excludingId && normalizeAccountName(row.name) === normalized,
  );
}

export async function createAccount(
  input: AccountFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { fieldErrors, accountType } = validateAccountInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  try {
    if (await isAccountNameTaken(supabase, user.id, input.name)) {
      return { ok: false, message: DUPLICATE_NAME_MESSAGE, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
    }
  } catch {
    return { ok: false, message: "Tidak dapat memeriksa nama rekening. Coba lagi." };
  }

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: input.name.trim().replace(/\s+/g, " "),
    account_type: accountType,
    initial_balance: input.initial_balance,
    // Keep the legacy database field consistent with the all-accounts rule.
    include_in_total: true,
    currency: "IDR",
    color: input.color ?? null,
    icon: input.icon ?? null,
  });

  if (error?.code === "23505") {
    return { ok: false, message: DUPLICATE_NAME_MESSAGE, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
  }

  if (error) {
    // Surface the DB error gracefully (e.g. an unexpected CHECK constraint on
    // account_type). We do not alter the schema here.
    return {
      ok: false,
      message: "Rekening gagal disimpan. Silakan coba lagi.",
    };
  }

  revalidatePath("/accounts");
  return { ok: true };
}

export async function updateAccount(
  id: string,
  input: AccountFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { fieldErrors, accountType } = validateAccountInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  // A snapshot makes stale edit forms fail instead of undoing new ledger activity.
  if (typeof input.expected_current_balance !== "number" ||
      !Number.isFinite(input.expected_current_balance)) {
    return { ok: false, message: "Saldo saat ini perlu dimuat ulang sebelum disimpan." };
  }

  // Grandfather existing duplicate names. Editing a balance or account type
  // must not force the user to rename an unrelated historic account.
  const { data: currentAccount, error: currentError } = await supabase
    .from("accounts")
    .select("name, initial_balance")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (currentError || !currentAccount) {
    return { ok: false, message: "Rekening tidak ditemukan atau tidak dapat dibaca." };
  }

  if (accountNameChanged(currentAccount.name, input.name)) {
    try {
      if (await isAccountNameTaken(supabase, user.id, input.name, id)) {
        return { ok: false, message: DUPLICATE_NAME_MESSAGE, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
      }
    } catch {
      return { ok: false, message: "Tidak dapat memeriksa nama rekening. Coba lagi." };
    }
  }

  // Recompute with the same ledger calculation used by the account list.
  let transactionNet: number;
  try {
    const netByAccount = await computeAccountBalances(supabase, user.id);
    transactionNet = netByAccount.get(id) ?? 0;
  } catch {
    return { ok: false, message: "Saldo terkini gagal dimuat. Coba lagi." };
  }
  const currentBalance = runningBalanceFromOpening(
    Number(currentAccount.initial_balance), transactionNet,
  );
  if (currentBalance === null) {
    return { ok: false, message: "Saldo rekening tidak dapat dihitung secara akurat." };
  }
  if (Math.round(currentBalance * 100) !==
      Math.round(input.expected_current_balance * 100)) {
    return { ok: false, message: "Saldo rekening sudah berubah. Muat ulang halaman sebelum menyimpan." };
  }
  const adjustedOpening = openingBalanceForTarget(input.initial_balance, transactionNet);
  if (adjustedOpening === null) {
    return {
      ok: false, message: "Saldo saat ini tidak valid atau terlalu besar.",
      fieldErrors: { initial_balance: "Masukkan nominal Rupiah yang valid." },
    };
  }

  const { data: updated, error } = await supabase
    .from("accounts")
    .update({
      name: input.name.trim().replace(/\s+/g, " "),
      account_type: accountType,
      initial_balance: adjustedOpening,
      // Keep the legacy database field consistent with the all-accounts rule.
      include_in_total: true,
      color: input.color ?? null,
      icon: input.icon ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("initial_balance", currentAccount.initial_balance)
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") {
    return { ok: false, message: DUPLICATE_NAME_MESSAGE, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
  }

  if (error) {
    return {
      ok: false,
      message: "Perubahan gagal disimpan. Silakan coba lagi.",
    };
  }

  if (!updated) {
    return { ok: false, message: "Rekening sudah berubah. Muat ulang halaman sebelum menyimpan." };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function setAccountArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: archived
        ? "Rekening gagal diarsipkan. Silakan coba lagi."
        : "Rekening gagal dipulihkan. Silakan coba lagi.",
    };
  }

  revalidatePath("/accounts");
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  // Hard delete is only safe when nothing references this account. The FK is
  // (user_id, account_id), so every count is scoped to this user and account.
  // transactions and recurring_transactions can reference the account as the
  // source (account_id) or the transfer destination (destination_account_id);
  // financial_goals reference it via account_id. We never cascade-delete.
  const countFor = (
    table: "transactions" | "recurring_transactions",
    column: "account_id" | "destination_account_id",
  ) =>
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq(column, id);

  const [txSource, txDest, recSource, recDest, goals, adjustments] = await Promise.all([
    countFor("transactions", "account_id"),
    countFor("transactions", "destination_account_id"),
    countFor("recurring_transactions", "account_id"),
    countFor("recurring_transactions", "destination_account_id"),
    supabase
      .from("financial_goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("account_id", id),
    supabase
      .from("account_balance_adjustments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("account_id", id),
  ]);

  const countErrors = [txSource, txDest, recSource, recDest, goals, adjustments].some(
    (r) => r.error,
  );
  if (countErrors) {
    return {
      ok: false,
      message: "Tidak bisa memeriksa keterkaitan rekening. Silakan coba lagi.",
    };
  }

  const referenceCount =
    (txSource.count ?? 0) +
    (txDest.count ?? 0) +
    (recSource.count ?? 0) +
    (recDest.count ?? 0) +
    (goals.count ?? 0) +
    (adjustments.count ?? 0);

  if (referenceCount > 0) {
    return {
      ok: false,
      message:
        "Rekening masih memiliki transaksi, riwayat penyesuaian saldo, atau data terkait. Arsipkan agar riwayat tetap aman.",
    };
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: "Rekening gagal dihapus. Silakan coba lagi.",
    };
  }

  revalidatePath("/accounts");
  return { ok: true };
}
