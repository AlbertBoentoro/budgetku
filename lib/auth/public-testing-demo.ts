/**
 * Public UI gallery is available only in Vercel Preview deployments.
 * It contains synthetic data and never grants Supabase access.
 * Production, including production aliases, must not expose the gallery.
 */
export function isPublicTestingDemoAllowed(): boolean {
  return process.env.VERCEL_ENV === "preview";
}
