// Forwarded receipts are untrusted fixtures, not authenticated bank messages.
// Never enable this path on production or on another database.
export function testingForwardEnabled(env: Record<string, string | undefined> = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  GMAIL_PUSH_TOPIC: process.env.GMAIL_PUSH_TOPIC,
}) {
  return env.VERCEL_ENV === "preview" &&
    (env.VERCEL_GIT_COMMIT_REF === "feat/gmail-push-sync" ||
      (!env.VERCEL_GIT_COMMIT_REF && env.GMAIL_PUSH_TOPIC === "projects/budgetku-511415/topics/budgetku-gmail-staging")) &&
    env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") === "https://omnzuolrlwczvnxrvenw.supabase.co";
}

export function isTestingForwardSubject(subject: string, enabled = testingForwardEnabled()) {
  const clean = subject.trim();
  return enabled && (/^(?:fwd?|terusan)\s*:\s*\S/i.test(clean) ||
    /^(?:Internet Transaction Journal|Your Grab E-Receipt)$/i.test(clean));
}

export function readTestingForward(subject: string, bodyText: string, enabled = testingForwardEnabled()) {
  if (!isTestingForwardSubject(subject, enabled)) return null;
  // Only the first explicit forwarded-message block, not arbitrary quoted text.
  const marker = /(?:^|\n)\s*(?:-+\s*(?:Forwarded message|Pesan yang diteruskan)\s*-+|Begin forwarded message:)\s*(?:\n|$)/i.exec(bodyText);
  if (!marker) return null;
  const forwarded = bodyText.slice(marker.index + marker[0].length);
  const lines = forwarded.split(/\r?\n/);
  const header = lines.slice(0, 12);
  const from = header.find(line => /^\s*(?:From|Dari)\s*:/i.test(line));
  const originalSubject = header.find(line => /^\s*(?:Subject|Subjek)\s*:/i.test(line));
  if (!from || !originalSubject) return null;
  const rawFrom = from.replace(/^\s*(?:From|Dari)\s*:\s*/i, "").trim();
  const address = (rawFrom.match(/<([^<>]+)>\s*$/)?.[1] ?? rawFrom).trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(address)) return null;
  const domain = address.split("@")[1];
  const cleanSubject = originalSubject.replace(/^\s*(?:Subject|Subjek)\s*:\s*/i, "").trim();
  const outerSubject = subject.trim().replace(/^(?:fwd?|terusan)\s*:\s*/i, "").trim();
  if (cleanSubject.toLowerCase() !== outerSubject.toLowerCase()) return null;
  if (domain === "grab.com") {
    if (cleanSubject.toLowerCase() !== "your grab e-receipt") return null;
  } else if (domain !== "bca.co.id" && !domain.endsWith(".bca.co.id")) {
    return null;
  }
  // Remove forwarded header lines and the user's introductory comment.
  const lastHeader = Math.max(...header.map((line, i) => /^\s*(?:From|Dari|Date|Tanggal|Sent|Subject|Subjek|To|Kepada|Cc)\s*:/i.test(line) ? i : -1));
  const receiptBody = lines.slice(lastHeader + 1).join("\n").trim();
  if (!receiptBody) return null;
  return { from: address, subject: cleanSubject, bodyText: receiptBody };
}
