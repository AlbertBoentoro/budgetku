import { createClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint } from "@/lib/settings/push";

type PushPayload = {
  endpoint: string;
  keys: { auth: string; p256dh: string };
};

function isPushPayload(value: unknown): value is PushPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const keys = candidate.keys;

  return (
    typeof candidate.endpoint === "string" &&
    isAllowedPushEndpoint(candidate.endpoint) &&
    Boolean(keys) &&
    typeof keys === "object" &&
    typeof (keys as Record<string, unknown>).auth === "string" &&
    /^[A-Za-z0-9_-]{16,128}$/.test(
      (keys as Record<string, string>).auth,
    ) &&
    typeof (keys as Record<string, unknown>).p256dh === "string" &&
    /^[A-Za-z0-9_-]{32,256}$/.test(
      (keys as Record<string, string>).p256dh,
    )
  );
}

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return textResponse("Sesi berakhir. Masuk kembali.", 401);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return textResponse("Notifikasi belum dikonfigurasi di server.", 503);
  }

  const endpoint = new URL(request.url).searchParams.get("endpoint");
  let enabled = false;
  if (endpoint) {
    if (!isAllowedPushEndpoint(endpoint)) {
      return textResponse("Alamat notifikasi tidak valid.", 400);
    }

    const { data: rows, error } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user.id);

    if (error) {
      console.error("Push subscription status lookup failed:", error.message);
      return textResponse("Status notifikasi gagal dibaca.", 500);
    }

    enabled = rows.some((row) => {
      const subscription = row.subscription;
      return (
        typeof subscription === "object" &&
        subscription !== null &&
        !Array.isArray(subscription) &&
        subscription.endpoint === endpoint
      );
    });
  }

  return Response.json(
    { publicKey, enabled },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return textResponse("Sesi berakhir. Masuk kembali.", 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return textResponse("Data notifikasi tidak valid.", 400);
  }
  if (!isPushPayload(payload)) {
    return textResponse("Data notifikasi tidak valid.", 400);
  }

  const { data: existing, error: selectError } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", user.id);

  if (selectError) {
    console.error("Push subscription lookup failed:", selectError.message);
    return textResponse("Pengaturan notifikasi gagal dibaca.", 500);
  }

  const duplicate = existing.find((row) => {
    const subscription = row.subscription;
    return (
      typeof subscription === "object" &&
      subscription !== null &&
      !Array.isArray(subscription) &&
      subscription.endpoint === payload.endpoint
    );
  });

  const subscription = {
    endpoint: payload.endpoint,
    keys: payload.keys,
  };
  const now = new Date().toISOString();

  const { error } = duplicate
    ? await supabase
        .from("push_subscriptions")
        .update({ subscription, updated_at: now })
        .eq("user_id", user.id)
        .eq("id", duplicate.id)
    : await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        subscription,
        updated_at: now,
      });

  if (error) {
    console.error("Push subscription save failed:", error.message);
    return textResponse("Notifikasi gagal disimpan.", 500);
  }

  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return textResponse("Sesi berakhir. Masuk kembali.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return textResponse("Data notifikasi tidak valid.", 400);
  }

  const endpoint =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).endpoint
      : null;
  if (typeof endpoint !== "string" || !isAllowedPushEndpoint(endpoint)) {
    return textResponse("Alamat notifikasi tidak valid.", 400);
  }

  const { data: rows, error: selectError } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", user.id);

  if (selectError) {
    console.error("Push subscription lookup failed:", selectError.message);
    return textResponse("Pengaturan notifikasi gagal dibaca.", 500);
  }

  const matches = rows.filter((row) => {
    const subscription = row.subscription;
    return (
      typeof subscription === "object" &&
      subscription !== null &&
      !Array.isArray(subscription) &&
      subscription.endpoint === endpoint
    );
  });

  for (const row of matches) {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("id", row.id);

    if (error) {
      console.error("Push subscription delete failed:", error.message);
      return textResponse("Notifikasi gagal dihapus.", 500);
    }
  }

  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
