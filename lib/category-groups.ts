/**
 * Visual-only grouping of existing transaction categories.
 *
 * The database stores only income/expense, not category sections. These groups
 * never rewrite category IDs, alter budgets or affect posting rules. Unknown
 * user-created names stay visible in Others.
 */
export const EXPENSE_CATEGORY_SECTIONS = [
  { key: "daily", label: "DAILY NEEDS" },
  { key: "household", label: "HOUSEHOLD NEEDS" },
  { key: "personal", label: "PERSONAL NEEDS" },
  { key: "finance", label: "FINANCE" },
  { key: "services", label: "SERVICES" },
  { key: "others", label: "OTHERS" },
] as const;

type SectionKey = (typeof EXPENSE_CATEGORY_SECTIONS)[number]["key"];
type CategoryPresentation = { section: SectionKey; icon: string; order: number };

// Explicit names only: never guess a user's spending classification from
// keyword fragments. Include names from the reference and from Budgetku.
const EXPENSE_PRESENTATION: Record<string, CategoryPresentation> = {
  "food & beverage": { section: "daily", icon: "🍜", order: 0 },
  "transportation": { section: "daily", icon: "🚌", order: 1 },
  "household needs": { section: "household", icon: "🏠", order: 0 },
  "bills & utilities": { section: "household", icon: "🧾", order: 1 },
  "pets": { section: "household", icon: "🐈", order: 2 },
  "family": { section: "household", icon: "👨‍👩‍👧", order: 3 },
  "shopping": { section: "personal", icon: "🛍️", order: 0 },
  "health & sports": { section: "personal", icon: "🏃", order: 1 },
  "donations & gifts": { section: "personal", icon: "🙌", order: 2 },
  "travel": { section: "personal", icon: "✈️", order: 3 },
  "entertainment": { section: "personal", icon: "🍿", order: 4 },
  "education": { section: "personal", icon: "📚", order: 5 },
  "loans": { section: "finance", icon: "🏦", order: 0 },
  "online loan": { section: "finance", icon: "🏦", order: 0 },
  "investment": { section: "finance", icon: "🪴", order: 1 },
  "business": { section: "finance", icon: "💼", order: 2 },
  "other financial expenses": { section: "finance", icon: "🗂️", order: 3 },
  "other services": { section: "services", icon: "⚙️", order: 0 },
  "others": { section: "others", icon: "🤔", order: 0 },
  "other expense": { section: "others", icon: "🤔", order: 0 },
};

const INCOME_PRESENTATION: Record<string, { icon: string; order: number }> = {
  "salary": { icon: "💼", order: 0 },
  "bonus": { icon: "🎉", order: 1 },
  "freelance": { icon: "🧑‍💻", order: 2 },
  "investment income": { icon: "📈", order: 3 },
  "gift received": { icon: "🎁", order: 4 },
  "other income": { icon: "💰", order: 5 },
};

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
}

export interface PresentedCategory<T> {
  category: T;
  icon: string;
}

export interface CategorySection<T> {
  key: string;
  label: string;
  items: PresentedCategory<T>[];
}

/** Group and order without mutating incoming rows, changing IDs or inventing rows. */
export function groupTransactionCategories<T extends { name: string }>(
  categories: readonly T[],
  direction: "expense" | "income",
): CategorySection<T>[] {
  if (direction === "income") {
    const items = categories.map((category, index) => {
      const detail = INCOME_PRESENTATION[normalizedName(category.name)];
      return { category, icon: detail?.icon ?? "🏷️", order: detail?.order ?? 100, index };
    });
    items.sort((a, b) => a.order - b.order || a.index - b.index);
    return items.length
      ? [{ key: "income", label: "PEMASUKAN", items: items.map(({ category, icon }) => ({ category, icon })) }]
      : [];
  }

  const bySection = new Map<SectionKey, Array<{ category: T; icon: string; order: number; index: number }>>();
  categories.forEach((category, index) => {
    const detail = EXPENSE_PRESENTATION[normalizedName(category.name)] ??
      { section: "others" as const, icon: "🏷️", order: 100 };
    const rows = bySection.get(detail.section) ?? [];
    rows.push({ category, icon: detail.icon, order: detail.order, index });
    bySection.set(detail.section, rows);
  });

  return EXPENSE_CATEGORY_SECTIONS.flatMap(({ key, label }) => {
    const rows = bySection.get(key);
    if (!rows?.length) return [];
    rows.sort((a, b) => a.order - b.order || a.index - b.index);
    return [{
      key,
      label,
      items: rows.map(({ category, icon }) => ({ category, icon })),
    }];
  });
}
