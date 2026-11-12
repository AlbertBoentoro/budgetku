/**
 * Public, entirely synthetic fixture for preview-only UI exploration.
 * Never fetch the authenticated staging user's transactions for anonymous UI.
 */
import type { AccountRow, CategoryRow } from "@/lib/transactions";
import type { DuplicateTransaction } from "@/components/transactions/transaction-selection-screens";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const NOW = "2026-11-12T00:00:00.000Z";

export const DEMO_ACCOUNTS: AccountRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    user_id: DEMO_USER_ID,
    name: "BcAAA",
    account_type: "bank",
    color: null,
    icon: null,
    created_at: NOW,
    updated_at: NOW,
    currency: "IDR",
    initial_balance: 1000000,
    include_in_total: true,
    is_archived: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    user_id: DEMO_USER_ID,
    name: "Dompet Gmail Testing",
    account_type: "ewallet",
    color: null,
    icon: null,
    created_at: NOW,
    updated_at: NOW,
    currency: "IDR",
    initial_balance: 100000,
    include_in_total: true,
    is_archived: false,
  },
];

function category(id: number, name: string, type: "expense" | "income"): CategoryRow {
  return {
    id: `00000000-0000-4000-8000-${String(300 + id).padStart(12, "0")}`,
    user_id: null,
    name,
    category_type: type,
    color: null,
    icon: null,
    created_at: NOW,
    updated_at: NOW,
    is_archived: false,
    is_system: true,
    parent_id: null,
    sort_order: id,
  };
}

export const DEMO_EXPENSE_CATEGORIES: CategoryRow[] = [
  category(1, "Food & Beverage", "expense"),
  category(2, "Transportation", "expense"),
  category(3, "Household Needs", "expense"),
  category(4, "Bills & Utilities", "expense"),
  category(5, "Family", "expense"),
  category(6, "Shopping", "expense"),
  category(7, "Health & Sports", "expense"),
  category(8, "Donations & Gifts", "expense"),
  category(9, "Travel", "expense"),
  category(10, "Entertainment", "expense"),
  category(11, "Education", "expense"),
  category(12, "Online Loan", "expense"),
  category(13, "Investment", "expense"),
  category(14, "Other Financial Expenses", "expense"),
  category(15, "Other Expense", "expense"),
];

export const DEMO_INCOME_CATEGORIES: CategoryRow[] = [
  category(101, "Salary", "income"),
  category(102, "Bonus", "income"),
  category(103, "Freelance", "income"),
  category(104, "Investment Income", "income"),
  category(105, "Gift Received", "income"),
  category(106, "Other Income", "income"),
];

const bankId = DEMO_ACCOUNTS[0].id;

function demoTransaction(
  idx: number,
  type: "expense" | "income",
  amount: number,
  merchant: string | null,
  description: string,
  categoryName: string,
  date: string,
): DuplicateTransaction {
  const categoryOptions = type === "expense" ? DEMO_EXPENSE_CATEGORIES : DEMO_INCOME_CATEGORIES;
  return {
    id: `00000000-0000-4000-8000-${String(1000 + idx).padStart(12, "0")}`,
    account_id: bankId,
    destination_account_id: null,
    category_id: categoryOptions.find((cat) => cat.name === categoryName)?.id ?? null,
    transaction_type: type,
    amount,
    merchant,
    description,
    transaction_at: `${date}T12:00:00.000Z`,
  };
}

export const DEMO_TRANSACTIONS: DuplicateTransaction[] = [
  demoTransaction(1, "expense", 150000, "nyanyo", "Contoh pengeluaran", "Other Expense", "2026-11-04"),
  demoTransaction(2, "expense", 200000, null, "Persembahan", "Donations & Gifts", "2026-11-04"),
  demoTransaction(3, "expense", 40000, null, "Transportasi lokal", "Transportation", "2026-11-04"),
  demoTransaction(4, "expense", 140000, null, "Contoh biaya", "Other Financial Expenses", "2026-11-04"),
  demoTransaction(5, "income", 150000, null, "Bonus", "Bonus", "2026-11-04"),
  demoTransaction(6, "expense", 50000, null, "Hiburan", "Entertainment", "2026-11-04"),
  demoTransaction(7, "expense", 50000, "skibidi", "Contoh pembelian", "Other Expense", "2026-10-08"),
];
