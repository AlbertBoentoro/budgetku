// Account type values shared by the app and the database (audit F-02).
//
// Canonical values the app offers and writes:
//   cash | bank | ewallet | credit_card | savings | investment
// The database CHECK (docs/sql/2026-11-account-types-align.sql) accepts these
// plus the legacy "other", which the app still reads but does not offer.
//
// "ewallet" is the spelling the live database already used. The app used to
// send "e_wallet" (rejected by the database), so that spelling is accepted as
// an alias on input and stored as "ewallet".
//
// No imports on purpose, so this can be unit-tested in plain Node.

export const ACCOUNT_TYPE_VALUES = [
  "cash",
  "bank",
  "ewallet",
  "credit_card",
  "savings",
  "investment",
] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPE_VALUES)[number];

// Values the database may hold that the app does not offer.
export const LEGACY_ACCOUNT_TYPE_VALUES = ["other"] as const;

// Old spellings mapped to their canonical value.
const ACCOUNT_TYPE_ALIASES: Record<string, AccountTypeValue> = {
  e_wallet: "ewallet",
};

// The canonical spelling of a stored or submitted value; unknown values are
// returned unchanged so they can still be displayed.
export function canonicalAccountType(value: string): string {
  return ACCOUNT_TYPE_ALIASES[value] ?? value;
}

export function isAccountTypeValue(value: string): value is AccountTypeValue {
  return (ACCOUNT_TYPE_VALUES as readonly string[]).includes(value);
}

export interface AccountInputFields {
  name: string;
  account_type: string;
  initial_balance: number;
}

// Server-side validation shared by create and edit. Returns the field errors
// and the canonical account type to write.
export function validateAccountInput(input: AccountInputFields): {
  fieldErrors: Record<string, string>;
  accountType: string;
} {
  const fieldErrors: Record<string, string> = {};
  const accountType =
    typeof input.account_type === "string"
      ? canonicalAccountType(input.account_type)
      : "";

  if (!input.name || input.name.trim().length === 0) {
    fieldErrors.name = "Nama rekening wajib diisi.";
  }

  if (!accountType || !isAccountTypeValue(accountType)) {
    fieldErrors.account_type = "Pilih jenis rekening yang tersedia.";
  }

  if (
    typeof input.initial_balance !== "number" ||
    !Number.isFinite(input.initial_balance) ||
    input.initial_balance < 0
  ) {
    fieldErrors.initial_balance = "Saldo awal harus berupa angka yang valid.";
  }

  return { fieldErrors, accountType };
}
