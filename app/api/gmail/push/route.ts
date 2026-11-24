import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGmailNotification } from "@/lib/gmail/push-notification";
import { PUSH_CONNECTION_FIELDS, pushConfigured, syncPushConnection } from "@/lib/gmail/push";
import { GmailReconnectRequiredError } from "@/lib/gmail/client";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!pushConfigured()) return new Response(null, { status: 503 });
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return new Response(null, { status: 401 });
  try {
    const ticket = await new google.auth.OAuth2().verifyIdToken({ idToken: token, audience: process.env.GMAIL_PUSH_AUDIENCE! });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email !== process.env.GMAIL_PUSH_SERVICE_ACCOUNT ||
        !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) return new Response(null, { status: 403 });
  } catch { return new Response(null, { status: 401 }); }
  let notification;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return new Response(null, { status: 400 });
    notification = readGmailNotification(JSON.parse(raw), process.env.GMAIL_PUSH_SUBSCRIPTION!);
  } catch { return new Response(null, { status: 400 }); }
  if (!notification) return new Response(null, { status: 400 });
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("email_connections").select(PUSH_CONNECTION_FIELDS)
      .eq("provider", "gmail").eq("status", "active").eq("email_address", notification.emailAddress);
    if (error) throw new Error("Gmail connection lookup failed");
    for (const row of data ?? []) {
      try { await syncPushConnection(db, row); }
      catch (e) { if (!(e instanceof GmailReconnectRequiredError)) throw e; }
    }
    return new Response(null, { status: 204 });
  } catch {
    // Do not log provider exceptions: they may contain email or token data.
    console.error("Gmail push sync failed; retry requested");
    return new Response(null, { status: 503 });
  }
}
