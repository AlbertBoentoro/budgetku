/**
 * Read-only recovery planning. No database writes.
 *
 * The v1 snapshot intentionally excludes Gmail OAuth connections/import rows.
 * The planner therefore blocks ANY modification (including notes, merchant,
 * timestamps and metadata) to email-linked financial rows: the isolated SQL
 * prototype requires full row identity and partial checks would give false
 * assurances. A clean preview is NOT permission to perform a restore; the
 * authenticated SQL apply must recheck current state and ownership atomically.
 */
export const RESTORE_TABLES = [
  "accounts", "budgets", "budgetItems", "categories", "transactions",
  "recurringTransactions", "financialGoals", "goalContributions", "merchantRules",
];

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isId = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const normalized = (value) => {
  if (Array.isArray(value)) return value.map(normalized);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, normalized(entry)]),
  );
};
const asString = (value) => JSON.stringify(normalized(value));

/**
 * @param {{
 *   incoming: { format?: string, version?: number, data: Record<string, any> },
 *   current: { data: Record<string, any> },
 *   userId: string,
 *   linkedTransactionIds?: string[],
 * }} options
 */
export function createRestorePreview({ incoming, current, userId, linkedTransactionIds = [] }) {
  if (!isId(userId)) throw new Error("Missing or invalid authenticated user identifier.");
  const problems = [];
  const add = (problem) => {
    if (problems.length < 60) problems.push(problem);
  };
  for (const [snapshot, label] of [[incoming, "Backup"], [current, "Current state"]]) {
    if (!isObject(snapshot) || !isObject(snapshot.data)) {
      throw new Error(label + " has no structured data.");
    }
    if (label === "Backup" &&
        (snapshot.format !== "budgetku-backup" || snapshot.version !== 1)) {
      throw new Error("Unrecognized backup format/version.");
    }
  }
  const incomingRows = {};
  const currentRows = {};
  for (const table of RESTORE_TABLES) {
    const inRows = incoming.data[table];
    const liveRows = current.data[table];
    if (!Array.isArray(inRows) || !Array.isArray(liveRows)) {
      throw new Error("Missing records for " + table + ".");
    }
    const checkRows = (rows, label) => {
      const result = new Map();
      for (const row of rows) {
        if (!isObject(row) || !isId(row.id)) {
          add(label + "/" + table + ": invalid row ID.");
          continue;
        }
        if (result.has(row.id)) {
          add(label + "/" + table + ": duplicate row ID.");
          continue;
        }
        if (row.user_id !== userId && !(table === "categories" && row.user_id === null && row.is_system === true)) {
          add(label + "/" + table + ": row does not belong to user.");
          continue;
        }
        result.set(row.id, row);
      }
      return result;
    };
    incomingRows[table] = checkRows(inRows, "Backup");
    currentRows[table] = checkRows(liveRows, "Current");
  }
  const categoryRows = incomingRows.categories;
  const liveCategoryRows = currentRows.categories;
  const categories = new Map();
  for (const [id, row] of liveCategoryRows) {
    if (row.user_id === null && row.is_system === true) categories.set(id, row);
  }
  for (const [id, row] of categoryRows) {
    if (row.user_id === null && row.is_system === true) {
      if (!categories.has(id)) {
        add("Backup references a system category missing from current database.");
      } else if (asString(categories.get(id)) !== asString(row)) {
        add("System category differs from current database; cannot overwrite shared data.");
      }
    } else {
      if (categories.has(id)) add("User category ID collides with system category.");
      categories.set(id, row);
    }
  }
  const requireLink = (source, row, field, records, optional = false) => {
    const target = row[field];
    if (optional && (target === null || target === undefined || target === "")) return;
    if (!isId(target) || !records.has(target)) add(source + ": missing " + field + " reference.");
  };
  const accounts = incomingRows.accounts;
  const budgets = incomingRows.budgets;
  const goals = incomingRows.financialGoals;
  for (const row of categoryRows.values()) {
    if (row.user_id === null) continue;
    requireLink("categories", row, "parent_id", categories, true);
    if (row.parent_id === row.id) add("Category cannot be its own parent.");
  }
  // Validate indirect category cycles that a normal single FK would accept.
  for (const row of categoryRows.values()) {
    const visited = new Set([row.id]);
    let parent = row.parent_id;
    while (parent && categories.has(parent)) {
      if (visited.has(parent)) {
        add("Category hierarchy contains a cycle.");
        break;
      }
      visited.add(parent);
      parent = categories.get(parent).parent_id;
    }
  }
  for (const row of incomingRows.budgetItems.values()) {
    requireLink("budgetItems", row, "budget_id", budgets);
    requireLink("budgetItems", row, "category_id", categories);
  }
  for (const table of ["transactions", "recurringTransactions"]) {
    for (const row of incomingRows[table].values()) {
      requireLink(table, row, "account_id", accounts);
      requireLink(table, row, "destination_account_id", accounts, true);
      requireLink(table, row, "category_id", categories, true);
      if (row.transaction_type === "transfer") {
        if (!row.destination_account_id || row.destination_account_id === row.account_id) {
          add(table + ": invalid transfer destination.");
        }
        if (row.category_id) add(table + ": transfer must not have category.");
      } else if (row.destination_account_id) {
        add(table + ": non-transfer cannot have destination.");
      } else if (row.category_id && categories.has(row.category_id) &&
        categories.get(row.category_id).category_type !== row.transaction_type) {
        add(table + ": category does not match transaction type.");
      }
    }
  }
  for (const row of goals.values()) requireLink("financialGoals", row, "account_id", accounts, true);
  for (const row of incomingRows.goalContributions.values()) {
    requireLink("goalContributions", row, "goal_id", goals);
  }
  for (const row of incomingRows.merchantRules.values()) {
    requireLink("merchantRules", row, "category_id", categories);
  }
  // Backups intentionally omit Gmail OAuth connections and imports.
  // Never silently delete/rewrite transactions referenced by a Gmail import.
  const protectedIds = [...new Set(linkedTransactionIds)];
  for (const id of protectedIds) {
    if (!isId(id)) {
      add("Invalid linked Gmail transaction ID.");
      continue;
    }
    const saved = incomingRows.transactions.get(id);
    const active = currentRows.transactions.get(id);
    if (!active || !saved) {
      add("A Gmail-linked transaction is absent from the backup; restore would break its link.");
      continue;
    }
    if (asString(saved) !== asString(active)) {
      add("A Gmail-linked transaction changed since this backup; restore would rewrite its imported details.");
    }
  }
  const tables = {};
  for (const table of RESTORE_TABLES) {
    const next = new Map([...incomingRows[table]].filter(([, row]) =>
      !(table === "categories" && row.user_id === null)));
    const now = new Map([...currentRows[table]].filter(([, row]) =>
      !(table === "categories" && row.user_id === null)));
    let added = 0, modified = 0, removed = 0;
    for (const [id, row] of next) {
      if (!now.has(id)) added += 1;
      else if (asString(row) !== asString(now.get(id))) modified += 1;
    }
    for (const id of now.keys()) if (!next.has(id)) removed += 1;
    tables[table] = {
      current: now.size,
      backup: next.size,
      wouldAdd: added,
      wouldUpdate: modified,
      wouldRemove: removed,
    };
  }
  const preferences = incoming.data.preferences;
  if (preferences !== null && preferences !== undefined && !isObject(preferences)) {
    add("Invalid backup user preferences.");
  }
  return {
    previewOnly: true,
    eligibleForAtomicRestore: problems.length === 0,
    blockers: problems,
    externalGmailLinks: protectedIds.length,
    tables,
  };
}
