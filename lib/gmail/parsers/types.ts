// Pure parsing contract for the Gmail import feature (design §6.1).
//
// A parser turns a single email's already-decoded text into a best-effort
// transaction DRAFT. Parsers are pure and injectable: no network, no DB, no
// secrets. The sync engine (FEAT-003) decodes the Gmail message body, resolves
// a parser by sender, calls parse(), and stores only honest metadata — a
// ParseResult is never persisted as a fabricated amount.

// A single detected draft. `ok:false` means the email could not be parsed into
// a confident transaction; the sync engine marks it needs_review and NEVER
// fabricates a value. `null` fields mean "not detected" (not zero, not today).
export interface ParseResult {
  // false => needs_review, no fabricated values were produced.
  ok: boolean;
  // Positive unscaled IDR integer, or null when no amount was detected.
  amount: number | null;
  // Movement direction relative to the user's money, or null when unknown.
  direction: "income" | "expense" | null;
  // Transaction date as "YYYY-MM-DD", or null when no date was detected.
  transactionAt: string | null;
  // Best-effort counterparty/merchant label, or null.
  merchant: string | null;
  // Short human-readable description, or null.
  description: string | null;
  // "low" => still surfaced to the user, but flagged as uncertain.
  confidence: "high" | "low";
}

// The input a parser receives. `bodyText` is the already-decoded plain-text
// body (the sync engine handles base64url decoding and HTML-to-text); parsers
// stay pure and do no I/O. `receivedAt` is an ISO-ish timestamp used only as a
// date fallback when the body has no confident date.
export interface GmailParser {
  source: "bca" | "shopee" | "gopay";
  parse(input: {
    subject: string;
    from: string;
    bodyText: string;
    receivedAt: string;
  }): ParseResult;
}
