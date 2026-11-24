// Pure validation of the documented wrapped Pub/Sub Gmail payload.
export function readGmailNotification(value: unknown, subscription: string) {
  if (!value || typeof value !== "object") return null;
  const body = value as { subscription?: unknown; message?: { data?: unknown } };
  if (body.subscription !== subscription || typeof body.message?.data !== "string" ||
      body.message.data.length > 8192 || !/^[A-Za-z0-9+/=_-]+$/.test(body.message.data)) return null;
  try {
    const data = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8"));
    if (typeof data.emailAddress !== "string" || !/^[^\s@]+@[^\s@]+$/.test(data.emailAddress) ||
        typeof data.historyId !== "string" || !/^\d{1,30}$/.test(data.historyId)) return null;
    return { emailAddress: data.emailAddress.toLowerCase(), historyId: data.historyId };
  } catch { return null; }
}
