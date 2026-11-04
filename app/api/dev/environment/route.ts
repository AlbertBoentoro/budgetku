import { isStagingSmartRestoreAllowed } from "@/lib/settings/smart-restore-guard";

export function GET() {
  if (!isStagingSmartRestoreAllowed()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(
    {
      environment: "development-testing",
      supabase: "budgetku-staging",
      productionData: false,
      manualTesting: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
