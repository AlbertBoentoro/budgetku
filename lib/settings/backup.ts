import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

type BackupClient = SupabaseClient<Database>;
type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(`Backup query failed: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

export async function buildUserBackup(
  supabase: BackupClient,
  userId: string,
) {
  const [
    accounts,
    budgets,
    budgetItems,
    categories,
    transactions,
    recurringTransactions,
    goals,
    goalContributions,
    merchantRules,
    preferences,
  ] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("budget_items")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("categories")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("recurring_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("financial_goals")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("goal_contributions")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("merchant_rules")
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("user_settings")
      .select(
        "locale, currency, first_day_of_week, daily_reminder_enabled, daily_reminder_time, cloud_backup_enabled",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (preferences.error) {
    throw new Error(`Backup preferences query failed: ${preferences.error.message}`);
  }

  return {
    format: "budgetku-backup",
    version: 1,
    generatedAt: new Date().toISOString(),
    data: {
      accounts,
      budgets,
      budgetItems,
      categories,
      transactions,
      recurringTransactions,
      financialGoals: goals,
      goalContributions,
      merchantRules,
      preferences: preferences.data,
    },
  };
}
