/**
 * Smart Restore (selective, non-destructive) planner.
 * Only *missing* manual transactions with surviving references are eligible.
 * Never interpret a missing row as "accidentally deleted"; the user decides.
 */
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isUUID = (v) => typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function createSmartRestorePlan({ incoming, current, userId }) {
  if (!isUUID(userId) || !isRecord(incoming?.data) || !isRecord(current?.data)) {
    throw new Error("Invalid backup or current ledger");
  }
  if (incoming.format !== "budgetku-backup" || incoming.version !== 1) {
    throw new Error("Unsupported backup format");
  }
  const required = ["transactions", "accounts", "categories"];
  for (const key of required) {
    if (!Array.isArray(incoming.data[key]) || !Array.isArray(current.data[key])) {
      throw new Error("Missing backup/current data: " + key);
    }
  }

  const currentTransactions = new Map();
  for (const row of current.data.transactions) {
    if (!isRecord(row) || !isUUID(row.id) || row.user_id !== userId ||
        currentTransactions.has(row.id)) {
      throw new Error("Invalid current transaction ownership or duplicate");
    }
    currentTransactions.set(row.id, row);
  }
  const accounts = new Map();
  for (const row of current.data.accounts) {
    if (!isRecord(row) || !isUUID(row.id) || row.user_id !== userId ||
        accounts.has(row.id)) throw new Error("Invalid current account data");
    accounts.set(row.id, row);
  }
  const categories = new Map();
  for (const row of current.data.categories) {
    if (!isRecord(row) || !isUUID(row.id) || categories.has(row.id) ||
        (row.user_id !== userId && !(row.user_id === null && row.is_system === true))) {
      throw new Error("Invalid current category data");
    }
    categories.set(row.id, row);
  }

  const seen = new Set();
  const candidates = [];
  let alreadyPresent = 0;
  if (incoming.data.transactions.length > 20000) throw new Error("Backup has too many transactions");
  for (const row of incoming.data.transactions) {
    if (!isRecord(row) || !isUUID(row.id) || row.user_id !== userId || seen.has(row.id)) {
      throw new Error("Invalid backup transaction ownership or duplicate");
    }
    seen.add(row.id);
    if (currentTransactions.has(row.id)) {
      alreadyPresent++;
      continue;
    }
    const source = accounts.get(row.account_id);
    const destination = row.destination_account_id
      ? accounts.get(row.destination_account_id) : null;
    const category = row.category_id ? categories.get(row.category_id) : null;
    let reason = null;
    if (row.source !== "manual" || row.source_reference != null) {
      reason = "Jenis transaksi ini belum didukung untuk pemulihan satuan.";
    } else if (row.currency !== "IDR" || !Number.isSafeInteger(Number(row.amount)) ||
      Number(row.amount) <= 0 || Number(row.amount) > 1000000000000 ||
      typeof row.transaction_at !== "string" || !Number.isFinite(Date.parse(row.transaction_at)) ||
      typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) ||
      typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) {
      reason = "Nilai atau tanggal transaksi tidak valid.";
    } else if (!source || source.is_archived || source.currency !== "IDR") {
      reason = "Rekening sumber sudah tidak tersedia.";
    } else if (row.transaction_type === "transfer") {
      if (!destination || destination.is_archived || destination.currency !== "IDR" ||
          row.destination_account_id === row.account_id || row.category_id) {
        reason = "Rekening tujuan transfer tidak tersedia.";
      }
    } else if (!["income", "expense"].includes(row.transaction_type)) {
      reason = "Jenis transaksi tidak dikenali.";
    } else if (row.destination_account_id || !category || category.is_archived ||
      category.category_type !== row.transaction_type) {
      reason = "Kategori transaksi sudah tidak tersedia atau tidak cocok.";
    }
    candidates.push({
      id: row.id,
      amount: Number(row.amount),
      transactionType: row.transaction_type,
      transactionAt: row.transaction_at,
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
      merchant: typeof row.merchant === "string" ? row.merchant : null,
      description: typeof row.description === "string" ? row.description : null,
      accountId: row.account_id,
      accountName: source?.name ?? "Rekening tidak tersedia",
      destinationAccountId: row.destination_account_id ?? null,
      destinationAccountName: destination?.name ?? null,
      categoryName: category?.name ?? null,
      eligible: reason === null,
      reason,
    });
  }
  if (candidates.length > 500) throw new Error("Too many missing transactions to preview at once");
  return {
    candidates,
    alreadyPresent,
    eligibleCount: candidates.filter((row) => row.eligible).length,
    blockedCount: candidates.filter((row) => !row.eligible).length,
    defaultSelectedIds: [],
  };
}

export function selectedRestoreImpact(candidates, ids) {
  if (!Array.isArray(ids) || ids.length > 50 || new Set(ids).size !== ids.length) {
    throw new Error("Invalid selection");
  }
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const accounts = new Map();
  for (const id of ids) {
    const row = byId.get(id);
    if (!row?.eligible) throw new Error("Selected transaction cannot be restored");
    const amount = row.amount;
    const change = (accountId, name, delta) => {
      const previous = accounts.get(accountId) ?? { accountId, name, delta: 0 };
      previous.delta += delta;
      if (!Number.isSafeInteger(previous.delta)) throw new Error("Invalid total");
      accounts.set(accountId, previous);
    };
    if (row.transactionType === "income") change(row.accountId, row.accountName, amount);
    else if (row.transactionType === "expense") change(row.accountId, row.accountName, -amount);
    else if (row.transactionType === "transfer") {
      change(row.accountId, row.accountName, -amount);
      change(row.destinationAccountId, row.destinationAccountName, amount);
    }
  }
  return { count: ids.length, accountChanges: [...accounts.values()] };
}
