"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isGoalIcon } from "@/lib/goals";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export interface GoalFormInput {
  name: string;
  target_amount: number;
  target_date: string | null;
  account_id: string | null;
  notes: string | null;
  status: string;
  icon?: string | null;
  color?: string | null;
}

export interface ContributionFormInput {
  amount: number;
  contributed_at: string | null;
  note: string | null;
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Logical statuses the UI may set. `status` is plain text in the DB; we only
// ever write one of these three. A DB CHECK rejection is surfaced gracefully.
const ALLOWED_STATUSES = new Set(["active", "achieved", "archived"]);

// Matches a canonical "YYYY-MM-DD" date and confirms it is a real calendar date
// (so "2026-13-40" is rejected).
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

// Confirms the goal belongs to the user. Returns false on any failure so we
// fail closed rather than trusting RLS alone.
async function ownsGoal(
  supabase: ServerSupabaseClient,
  userId: string,
  goalId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("financial_goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

// Confirms a chosen account belongs to the user and is non-archived. Returns
// false on any failure (mirrors canUseExpenseCategory). Only called when an
// account_id is actually provided.
async function canUseAccount(
  supabase: ServerSupabaseClient,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

function validateGoalShape(input: GoalFormInput): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    fieldErrors.name = "Nama target wajib diisi.";
  }

  if (
    typeof input.target_amount !== "number" ||
    !Number.isFinite(input.target_amount) ||
    input.target_amount <= 0
  ) {
    fieldErrors.target_amount =
      "Nominal target harus berupa angka lebih dari nol.";
  }

  if (input.target_date && !isValidDateString(input.target_date)) {
    fieldErrors.target_date = "Tanggal target tidak valid.";
  }

  return fieldErrors;
}

function validateContribution(
  input: ContributionFormInput,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (
    typeof input.amount !== "number" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    fieldErrors.amount = "Nominal harus berupa angka lebih dari nol.";
  }

  if (input.contributed_at && !isValidDateString(input.contributed_at)) {
    fieldErrors.contributed_at = "Tanggal tidak valid.";
  }

  return fieldErrors;
}

// Normalizes a status to one of the allowed logical values; anything else
// becomes "active" so a tampered request can never write a surprise value.
function normalizeStatus(status: string | undefined): string {
  if (status && ALLOWED_STATUSES.has(status)) return status;
  return "active";
}

// Normalizes a chosen icon to a curated value or null.
function normalizeIcon(icon: string | null | undefined): string | null {
  if (icon && isGoalIcon(icon)) return icon;
  return null;
}

export async function createGoal(
  input: GoalFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const fieldErrors = validateGoalShape(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  // Validate the optional linked account belongs to the user and is active.
  if (input.account_id) {
    if (!(await canUseAccount(supabase, user.id, input.account_id))) {
      return {
        ok: false,
        message: "Rekening tidak tersedia.",
        fieldErrors: { account_id: "Rekening tidak tersedia." },
      };
    }
  }

  const trimmedNotes = input.notes?.trim();

  const { error } = await supabase.from("financial_goals").insert({
    user_id: user.id,
    name: input.name.trim(),
    target_amount: input.target_amount,
    target_date: input.target_date ? input.target_date : null,
    account_id: input.account_id ? input.account_id : null,
    notes: trimmedNotes ? trimmedNotes : null,
    status: normalizeStatus(input.status),
    icon: normalizeIcon(input.icon),
  });

  if (error) {
    // Surface a possible status CHECK/constraint rejection gracefully; the DB
    // is never altered here.
    return { ok: false, message: "Target gagal disimpan. Silakan coba lagi." };
  }

  revalidatePath("/goals");
  return { ok: true };
}

export async function updateGoal(
  id: string,
  input: GoalFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const fieldErrors = validateGoalShape(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  if (!(await ownsGoal(supabase, user.id, id))) {
    return { ok: false, message: "Target tidak ditemukan." };
  }

  if (input.account_id) {
    if (!(await canUseAccount(supabase, user.id, input.account_id))) {
      return {
        ok: false,
        message: "Rekening tidak tersedia.",
        fieldErrors: { account_id: "Rekening tidak tersedia." },
      };
    }
  }

  const trimmedNotes = input.notes?.trim();

  const { error } = await supabase
    .from("financial_goals")
    .update({
      name: input.name.trim(),
      target_amount: input.target_amount,
      target_date: input.target_date ? input.target_date : null,
      account_id: input.account_id ? input.account_id : null,
      notes: trimmedNotes ? trimmedNotes : null,
      status: normalizeStatus(input.status),
      icon: normalizeIcon(input.icon),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Perubahan gagal disimpan. Silakan coba lagi." };
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
  return { ok: true };
}

// Lightweight status change for archive/restore/mark-achieved controls.
export async function setGoalStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return { ok: false, message: "Status tidak valid." };
  }

  const { error } = await supabase
    .from("financial_goals")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Status target gagal diubah. Silakan coba lagi." };
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
  return { ok: true };
}

// Hard delete (Decision 4). The FK goal_contributions.goal_id has no
// ON DELETE CASCADE, so child contributions are deleted first (scoped
// user_id + goal_id), then the goal (scoped user_id). Every delete is
// user-scoped; a failure is surfaced gracefully.
export async function deleteGoal(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { error: contribError } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("user_id", user.id)
    .eq("goal_id", id);

  if (contribError) {
    return {
      ok: false,
      message: "Kontribusi target gagal dihapus. Silakan coba lagi.",
    };
  }

  const { error } = await supabase
    .from("financial_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Target gagal dihapus. Silakan coba lagi." };
  }

  revalidatePath("/goals");
  return { ok: true };
}

export async function addContribution(
  goalId: string,
  input: ContributionFormInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const fieldErrors = validateContribution(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali isian formulir.", fieldErrors };
  }

  if (!(await ownsGoal(supabase, user.id, goalId))) {
    return { ok: false, message: "Target tidak ditemukan." };
  }

  const trimmedNote = input.note?.trim();

  const { error } = await supabase.from("goal_contributions").insert({
    user_id: user.id,
    goal_id: goalId,
    amount: input.amount,
    // Leave contributed_at to the DB default (now) unless a date was chosen.
    ...(input.contributed_at ? { contributed_at: input.contributed_at } : {}),
    note: trimmedNote ? trimmedNote : null,
  });

  if (error) {
    return { ok: false, message: "Kontribusi gagal disimpan. Silakan coba lagi." };
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  return { ok: true };
}

// Deletes one contribution. Scoped by id AND user_id so another user's id
// returns no row (no leak, no crash).
export async function deleteContribution(
  id: string,
  goalId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { error } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Kontribusi gagal dihapus. Silakan coba lagi." };
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  return { ok: true };
}
