// Match category names case-insensitively and collapse whitespace.
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isUserCategoryType(type: string): type is "income" | "expense" {
  return type === "income" || type === "expense";
}
