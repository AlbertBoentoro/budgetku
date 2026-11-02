/**
 * Temporary allowlist for isolated browser E2E only.
 *
 * Both the server-side opt-in and the exact separate Supabase project must
 * match. This must not turn on in Budgetku production by accident.
 * Even merging the code without all flags leaves the write route disabled.
 */
const STAGING_REF = "omnzuolrlwczvnxrvenw";
const PRODUCTION_REF = "zvmqrrttdrqkyrdzyxlf";
export function isStagingRestoreAllowed(): boolean {
  const stageUrl = "https://" + STAGING_REF + ".supabase.co";
  return (
    process.env.BUDGETKU_STAGING_E2E === "true" &&
    process.env.STAGING_PROJECT_REF === STAGING_REF &&
    process.env.STAGING_PROJECT_REF !== PRODUCTION_REF &&
    process.env.STAGING_SUPABASE_URL === stageUrl &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === stageUrl
  );
}
