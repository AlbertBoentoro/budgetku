/**
 * Keep Budgetku Testing login (email/password) independent from the
 * Smart Restore E2E feature flag. Previous staging previews lost the
 * testing login because Smart Restore env vars were not configured.
 *
 * Only the exact dedicated Supabase staging URL enables email/password.
 * Production must always keep its existing Google Auth flow.
 */
const STAGING_SUPABASE_URL = "https://omnzuolrlwczvnxrvenw.supabase.co";

export function isStagingEmailLoginAllowed(): boolean {
  return process.env.VERCEL_ENV !== "production" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === STAGING_SUPABASE_URL;
}
