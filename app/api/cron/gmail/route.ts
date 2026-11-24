import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUSH_CONNECTION_FIELDS, pushConfigured, syncPushConnection } from "@/lib/gmail/push";
import { GmailReconnectRequiredError } from "@/lib/gmail/client";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response(null, { status: 401 });
  if (!pushConfigured()) return Response.json({ enabled: false });
  try {
    const db = createAdminClient();
    let succeeded = 0, failed = 0;
    for (let from = 0; ; from += 100) {
      const { data, error } = await db.from("email_connections").select(PUSH_CONNECTION_FIELDS)
        .eq("provider", "gmail").eq("status", "active").order("id").range(from, from + 99);
      if (error) throw new Error("Gmail connection lookup failed");
      for (const row of data ?? []) {
        try { await syncPushConnection(db, row, true); succeeded++; }
        catch (e) { if (!(e instanceof GmailReconnectRequiredError)) failed++; }
      }
      if (!data || data.length < 100) break;
    }
    return Response.json({ succeeded, failed }, { status: failed ? 503 : 200 });
  } catch {
    console.error("Gmail watch renewal/reconciliation failed");
    return new Response(null, { status: 503 });
  }
}
