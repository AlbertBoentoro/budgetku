/** Smart Restore is enabled only for the exact approved Budgetku environments.
 * Production and staging can never be confused with preview deployments.
 * Production SQL must be installed and verified before merging this release.
 */
const STAGING_REF = "omnzuolrlwczvnxrvenw";
const PRODUCTION_REF = "zvmqrrttdrqkyrdzyxlf";
export function isStagingSmartRestoreAllowed(): boolean {
  const expected = "https://" + STAGING_REF + ".supabase.co";
  return process.env.VERCEL_ENV !== "production" &&
    process.env.BUDGETKU_STAGING_E2E === "true" &&
    process.env.STAGING_PROJECT_REF === STAGING_REF &&
    process.env.STAGING_SUPABASE_URL === expected &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === expected;
}
export function isProductionSmartRestoreAllowed(): boolean {
  return process.env.VERCEL_ENV === "production" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL ===
      "https://" + PRODUCTION_REF + ".supabase.co";
}
export function isSmartRestoreAllowed(): boolean {
  return isStagingSmartRestoreAllowed() || isProductionSmartRestoreAllowed();
}
