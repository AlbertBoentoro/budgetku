"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isMonthParam, toMonthStorage } from "@/lib/budgets";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export interface BudgetItemFormInput {
  category_id: string;
  planned_amount: number;
  is_fixed?: boolean;
  notes?: string | null;
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Confirms the category is usable for an expense budget: the user's own or a
// shared system category, non-archived, category_type='expense'. Returns false
// on any lookup failure so we fail closed rather than trusting RLS alone.
async function canUseExpenseCategory(
  supabase: ServerSupabaseClient,
  userId: string,
  categoryId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("is_archived", false)
    .eq("category_type", "expense")
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

// Confirms the budget belongs to the user. Returns false on any failure.
async function ownsBudget(
  supabase: ServerSupabaseClient,
  userId: string,
  budgetId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("budgets")
    .select("id")
    .eq("id", budgetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

// True when the budget already has an item for this category (optionally
// excluding one item id, used on edit so re-saving the same row is allowed).
async function hasCategoryItem(
  supabase: ServerSupabaseClient,
  userId: string,
  budgetId: string,
  categoryId: string,
  excludeItemId?: string,
): Promise<boolean> {
  let query = supabase
    .from("budget_items")
    .select("id")
    .eq("user_id", userId)
    .eq("budget_id", budgetId)
    .eq("category_id", categoryId);

  if (excludeItemId) {
    query = query.neq("id", excludeItemId);
  }

  const { data, error } = await query.maybeSingle();
  // On lookup error, report a duplicate so we fail closed (no silent dup write).
  if (error) return true;
  return Boolean(data);
}

function validateItem(
  input: BudgetItemFormInput,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!input.category_id || input.category_id.trim().length === 0) {
    fieldErrors.category_id = "Pilih kategori pengeluaran.";
  }

  if (
    typeof input.planned_amount !== "number" ||
    !Number.isFinite(input.planned_amount) ||
    input.planned_amount <= 0
  ) {
    fieldErrors.planned_amount = "Batas harus berupa angka lebih dari nol.";
  }

  return fieldErrors;
}

// Creates the single budget for a (user, month). Refuses a second budget for
// the same month (app-logic guard; no DB unique constraint assumed). month is
// the UI "YYYY-MM" value, stored canonically as "YYYY-MM-01".
export async function createBudget(
  monthParam: string,
  name?: string,
  notes?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  if (!isMonthParam(monthParam)) {
    return { ok: false, message: "Bulan tidak valid." };
  }

  const monthStorage = toMonthStorage(monthParam);

  // Guard: at most one budget per month.
  const { data: existing, error: existingError } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", user.id)
    .eq("month", monthStorage)
    .maybeSingle();

  if (existingError) {
    return { ok: false, message: "Anggaran gagal dibuat. Silakan coba lagi." };
  }
  if (existing) {
    return { ok: false, message: "Anggaran untuk bulan ini sudah ada." };
  }

  const trimmedName = name?.trim();
  const trimmedNotes = notes?.trim();

  const { error } = await supabase.from("budgets").insert({
    user_id: user.id,
    month: monthStorage,
    // Leave name to the DB default unless the user provided one.
    ...(trimmedName ? { name: trimmedName } : {}),
    notes: trimmedNotes ? trimmedNotes : null,
  });

  if (error) {
    // Surface a DB CHECK/constraint rejection gracefully; the DB is not altered.
    return { ok: false, message: "Anggaran gagal dibuat. Silakan coba lagi." };
  }

  revalidatePath("/budget");
  return { ok: true };
}

// Optional: edit a budget's name/notes. Scoped by id AND user_id.
export async function updateBudget(
  id: string,
  input: { name?: string | null; notes?: string | null },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const name = input.name?.trim();
  const notes = input.notes?.trim();

  const { error } = await supabase
    .from("budgets")
    .update({
      ...(name !== undefined ? { name: name ? name : "" } : {}),
      notes: notes ? notes : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Perubahan gagal disimpan. Silakan coba lagi." };
  }

  revalidatePath("/budget");
  return { ok: true };
}

// Adds a category limit to a budget. Validates ownership, category usability,
// and refuses a duplicate category in the same budget (app-logic guard).
export async function addBudgetItem(
  budgetId: string,
  input: BudgetItemFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const fieldErrors = validateItem(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  if (!(await ownsBudget(supabase, user.id, budgetId))) {
    return { ok: false, message: "Anggaran tidak ditemukan." };
  }

  if (!(await canUseExpenseCategory(supabase, user.id, input.category_id))) {
    return {
      ok: false,
      message: "Kategori tidak tersedia.",
      fieldErrors: { category_id: "Kategori pengeluaran tidak tersedia." },
    };
  }

  if (await hasCategoryItem(supabase, user.id, budgetId, input.category_id)) {
    return {
      ok: false,
      message: "Kategori ini sudah ada di anggaran bulan ini.",
      fieldErrors: { category_id: "Kategori ini sudah dianggarkan." },
    };
  }

  const { error } = await supabase.from("budget_items").insert({
    user_id: user.id,
    budget_id: budgetId,
    category_id: input.category_id,
    planned_amount: input.planned_amount,
    is_fixed: input.is_fixed ?? false,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  });

  if (error) {
    return { ok: false, message: "Batas kategori gagal disimpan. Silakan coba lagi." };
  }

  revalidatePath("/budget");
  return { ok: true };
}

// Edits an existing category limit. Scoped by id AND user_id; re-checks
// category usability and the duplicate guard (excluding this item).
export async function updateBudgetItem(
  id: string,
  input: BudgetItemFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const fieldErrors = validateItem(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  // Load the item scoped by id AND user_id to confirm ownership and get its
  // budget_id (another user's id returns no row — no leak, no crash).
  const { data: item, error: itemError } = await supabase
    .from("budget_items")
    .select("id, budget_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError || !item) {
    return { ok: false, message: "Batas kategori tidak ditemukan." };
  }

  if (!(await canUseExpenseCategory(supabase, user.id, input.category_id))) {
    return {
      ok: false,
      message: "Kategori tidak tersedia.",
      fieldErrors: { category_id: "Kategori pengeluaran tidak tersedia." },
    };
  }

  if (
    await hasCategoryItem(
      supabase,
      user.id,
      item.budget_id,
      input.category_id,
      id,
    )
  ) {
    return {
      ok: false,
      message: "Kategori ini sudah ada di anggaran bulan ini.",
      fieldErrors: { category_id: "Kategori ini sudah dianggarkan." },
    };
  }

  const { error } = await supabase
    .from("budget_items")
    .update({
      category_id: input.category_id,
      planned_amount: input.planned_amount,
      is_fixed: input.is_fixed ?? false,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Perubahan gagal disimpan. Silakan coba lagi." };
  }

  revalidatePath("/budget");
  return { ok: true };
}

// Deletes a category limit. Scoped by id AND user_id.
export async function deleteBudgetItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { error } = await supabase
    .from("budget_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Batas kategori gagal dihapus. Silakan coba lagi." };
  }

  revalidatePath("/budget");
  return { ok: true };
}
