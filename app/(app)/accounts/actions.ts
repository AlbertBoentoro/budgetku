"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isAccountType } from "@/lib/accounts";

export interface AccountFormInput {
  name: string;
  account_type: string;
  initial_balance: number;
  include_in_total: boolean;
  color?: string | null;
  icon?: string | null;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

// Shared server-side validation. Mirrors the client-side checks in AccountForm
// so a tampered or scripted request is still rejected before touching the DB.
function validate(input: AccountFormInput): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    fieldErrors.name = "Nama rekening wajib diisi.";
  }

  if (!input.account_type || !isAccountType(input.account_type)) {
    fieldErrors.account_type = "Pilih jenis rekening yang tersedia.";
  }

  if (
    typeof input.initial_balance !== "number" ||
    !Number.isFinite(input.initial_balance) ||
    input.initial_balance < 0
  ) {
    fieldErrors.initial_balance = "Saldo awal harus berupa angka yang valid.";
  }

  return fieldErrors;
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

  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: input.name.trim(),
    account_type: input.account_type,
    initial_balance: input.initial_balance,
    include_in_total: input.include_in_total,
    currency: "IDR",
    color: input.color ?? null,
    icon: input.icon ?? null,
  });

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

  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: input.name.trim(),
      account_type: input.account_type,
      initial_balance: input.initial_balance,
      include_in_total: input.include_in_total,
      color: input.color ?? null,
      icon: input.icon ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      message: "Perubahan gagal disimpan. Silakan coba lagi.",
    };
  }

  revalidatePath("/accounts");
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

  const [txSource, txDest, recSource, recDest, goals] = await Promise.all([
    countFor("transactions", "account_id"),
    countFor("transactions", "destination_account_id"),
    countFor("recurring_transactions", "account_id"),
    countFor("recurring_transactions", "destination_account_id"),
    supabase
      .from("financial_goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("account_id", id),
  ]);

  const countErrors = [txSource, txDest, recSource, recDest, goals].some(
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
    (goals.count ?? 0);

  if (referenceCount > 0) {
    return {
      ok: false,
      message:
        "Rekening ini masih dipakai transaksi atau data lain. Arsipkan saja agar riwayat tetap aman.",
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
