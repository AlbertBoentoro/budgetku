"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { validateAccountInput } from "@/lib/account-types";

export interface AccountFormInput {
  name: string;
  account_type: string;
  initial_balance: number;
  color?: string | null;
  icon?: string | null;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

// Server-side validation (lib/account-types.ts) mirrors the client checks in
// AccountForm, so a tampered or scripted request is still rejected before
// touching the DB. It also returns the canonical account type to write.

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

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: input.name.trim(),
    account_type: accountType,
    initial_balance: input.initial_balance,
    // Keep the legacy database field consistent with the all-accounts rule.
    include_in_total: true,
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

  const { fieldErrors, accountType } = validateAccountInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: input.name.trim(),
      account_type: accountType,
      initial_balance: input.initial_balance,
      // Keep the legacy database field consistent with the all-accounts rule.
      include_in_total: true,
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
