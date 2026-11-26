// Validate the wrapped Pub/Sub Gmail payload without logging mailbox data.
export function inspectGmailNotification(value: unknown, subscription: string) {
  if (!value || typeof value !== "object") return { ok: false, reason: "envelope" } as const;
  const body = value as { subscription?: unknown; message?: { data?: unknown } };
  if (body.subscription !== subscription) return { ok: false, reason: "subscription" } as const;
  if (typeof body.message?.data !== "string" || body.message.data.length > 8192 ||
      !/^[A-Za-z0-9+/_-]+={0,2}$/.test(body.message.data)) return { ok: false, reason: "message_data" } as const;
  try {
    const data = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8"));
    if (!data || typeof data !== "object") return { ok: false, reason: "decoded_payload" } as const;
    if (typeof data.emailAddress !== "string" || !/^[^\s@]+@[^\s@]+$/.test(data.emailAddress)) return { ok: false, reason: "email_address" } as const;
    // Accept decimal strings and losslessly representable non-negative integers.
    // Sync uses the authoritative Gmail history cursor, not this notification hint.
    const id = typeof data.historyId === "number" && Number.isSafeInteger(data.historyId) && data.historyId >= 0
      ? String(data.historyId) : data.historyId;
    if (typeof id !== "string" || !/^\d{1,30}$/.test(id)) return { ok: false, reason: "history_id" } as const;
    return { ok: true, notification: { emailAddress: data.emailAddress.toLowerCase(), historyId: id } } as const;
  } catch { return { ok: false, reason: "decoded_json" } as const; }
}
export function readGmailNotification(value: unknown, subscription: string) {
  const result = inspectGmailNotification(value, subscription);
  return result.ok ? result.notification : null;
}
