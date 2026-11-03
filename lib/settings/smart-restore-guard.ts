/**
 * Selective restore writes are permitted only for local E2E against the
 * dedicated synthetic Supabase staging project. Never on Vercel production.
 */
const STAGING_REF = "omnzuolrlwczvnxrvenw";
export function isStagingSmartRestoreAllowed(): boolean {
  const expected = "https://" + STAGING_REF + ".supabase.co";
  return process.env.VERCEL_ENV !== "production" &&
    process.env.BUDGETKU_STAGING_E2E === "true" &&
    process.env.STAGING_PROJECT_REF === STAGING_REF &&
    process.env.STAGING_SUPABASE_URL === expected &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === expected;
}
