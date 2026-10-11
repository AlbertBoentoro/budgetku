import {
  PiggyBank,
  Target,
  Plane,
  GraduationCap,
  Home,
  Gift,
  type LucideIcon,
} from "lucide-react";

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { parseIdrInput } from "@/lib/accounts";

// Re-export the shared IDR parser so goal forms/actions use the exact same
// unscaled money parsing as accounts/transactions/budgets (never a duplicate).
export { parseIdrInput };

// Row shapes straight from the generated DB types so this layer stays in sync
// with the real tables (no hand-maintained duplicates).
export type GoalRow = Database["public"]["Tables"]["financial_goals"]["Row"];
export type GoalContributionRow =
  Database["public"]["Tables"]["goal_contributions"]["Row"];

// The Supabase server client is created per-request; helpers accept the awaited
// client so callers keep control of auth/session handling.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Only the columns the contribution aggregation needs, from the generated type.
type ContributionSumRow = Pick<
  Database["public"]["Tables"]["goal_contributions"]["Row"],
  "goal_id" | "amount"
>;

// Logical goal statuses the UI understands. `status` is plain text in the DB
// (not an enum), so any other stored value is treated as "active" for grouping.
export type GoalStatus = "active" | "achieved" | "archived";

// Curated, restrained set of goal icons. `icon` is nullable text in the DB; an
// unknown/absent value falls back to a neutral default so the list never
// crashes on an unexpected value.
export const GOAL_ICONS = [
  { value: "piggy_bank", label: "Celengan", icon: PiggyBank },
  { value: "target", label: "Target", icon: Target },
  { value: "plane", label: "Liburan", icon: Plane },
  { value: "graduation_cap", label: "Pendidikan", icon: GraduationCap },
  { value: "home", label: "Rumah", icon: Home },
  { value: "gift", label: "Hadiah", icon: Gift },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
}>;

export type GoalIconValue = (typeof GOAL_ICONS)[number]["value"];

export const DEFAULT_GOAL_ICON: GoalIconValue = "target";

export function isGoalIcon(value: string): value is GoalIconValue {
  return GOAL_ICONS.some((g) => g.value === value);
}

// Returns the curated icon component, or a neutral fallback (Target) for an
// unknown/absent value so an unexpected icon never breaks a row.
export function getGoalIcon(value: string | null): LucideIcon {
  const match = GOAL_ICONS.find((g) => g.value === value);
  return match ? match.icon : Target;
}

// Indonesian date display (e.g. "4 Mar 2025"), guarded against invalid input so
// a malformed date never crashes a row (mirrors formatDate in
// transaction-list-row.tsx).
const goalDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatGoalDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return goalDateFormatter.format(date);
}

// Pure progress math for one goal. No rounding/scaling of the stored IDR
// values; divide-by-zero and non-finite inputs are guarded (Decision 1).
export interface GoalProgress {
  target: number;
  saved: number;
  remaining: number; // max(target - saved, 0)
  progress: number; // saved / target, 0 when target <= 0
  barPercent: number; // clamp(progress * 100, 0, 100) — bar width only
  isAchieved: boolean; // saved >= target (with target > 0)
}

export function computeGoalProgress(
  target: number,
  saved: number,
): GoalProgress {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const safeSaved = Number.isFinite(saved) ? saved : 0;
  const progress = safeTarget > 0 ? safeSaved / safeTarget : 0;
  const barPercent = Math.max(0, Math.min(100, progress * 100));
  const remaining = Math.max(safeTarget - safeSaved, 0);
  const isAchieved = safeTarget > 0 && safeSaved >= safeTarget;
  return {
    target: safeTarget,
    saved: safeSaved,
    remaining,
    progress,
    barPercent,
    isAchieved,
  };
}

// Maps a goal + its computed progress to a logical grouping bucket (Decision
// 3): archived status wins; otherwise an achieved goal (status or derived)
// groups under "Tercapai"; everything else is "active".
export function resolveGoalStatus(
  statusRaw: string,
  isAchieved: boolean,
): GoalStatus {
  if (statusRaw === "archived") return "archived";
  if (statusRaw === "achieved" || isAchieved) return "achieved";
  return "active";
}

// View type the list/row components consume: a goal plus its computed progress
// and grouping bucket.
export interface GoalView extends GoalRow {
  progress: GoalProgress;
  group: GoalStatus;
}

// All of the user's goals, oldest first so the list order is stable as goals
// are added (matches the other lists' ordering).
export async function fetchGoals(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from("financial_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as GoalRow[];
}

/**
 * Total saved per goal, as a Map of goal id -> summed contribution amount.
 *
 * Definition: sum of goal_contributions.amount scoped to the user, for the
 * given goal ids. Contributions are their own records; this never infers them
 * from transactions.
 *
 * Security: strictly scoped by the caller-supplied userId (which must come from
 * supabase.auth.getUser(), never client input). Anon/publishable client; RLS
 * stays the backstop.
 *
 * Performance: a SINGLE user-scoped select folded in one TS pass into the Map
 * (no per-goal query, no N+1) — mirrors computeCategorySpending.
 *
 * Precision: IDR has no minor units; amounts are unscaled whole rupiah. Each
 * amount is coerced with Number() and a non-finite row is skipped so one bad
 * row cannot poison a goal total. Throws on query error so the caller can show
 * an incomplete-notice rather than a silently wrong total.
 */
export async function computeContributionTotals(
  supabase: ServerSupabaseClient,
  userId: string,
  goalIds: string[],
): Promise<Map<string, number>> {
  // Nothing to sum: skip the query entirely.
  if (goalIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .select("goal_id, amount")
    .eq("user_id", userId)
    .in("goal_id", goalIds);

  if (error) {
    throw new Error(`Gagal menghitung kontribusi target: ${error.message}`);
  }

  const totals = new Map<string, number>();
  for (const row of (data ?? []) as ContributionSumRow[]) {
    if (!row.goal_id) continue;
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;
    totals.set(row.goal_id, (totals.get(row.goal_id) ?? 0) + amt);
  }

  return totals;
}

// One goal (scoped id + user_id) plus its contributions, newest first. Returns
// null goal when missing/not owned (another user's id returns no row). Keeping
// contributions descending matches the Phase 3 fix the user asked for (newest
// at the top), never the old ascending bug.
export async function fetchGoalWithContributions(
  supabase: ServerSupabaseClient,
  userId: string,
  goalId: string,
): Promise<{ goal: GoalRow | null; contributions: GoalContributionRow[] }> {
  const { data: goalData, error: goalError } = await supabase
    .from("financial_goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError || !goalData) {
    return { goal: null, contributions: [] };
  }

  const { data: contribData, error: contribError } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("user_id", userId)
    .eq("goal_id", goalId)
    .order("contributed_at", { ascending: false })
    .order("created_at", { ascending: false });

  return {
    goal: goalData as GoalRow,
    contributions: contribError
      ? []
      : ((contribData ?? []) as GoalContributionRow[]),
  };
}
