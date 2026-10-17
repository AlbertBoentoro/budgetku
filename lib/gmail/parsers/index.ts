// Sender -> parser registry (design §5/§6). Resolves a Gmail "From" header to
// the matching source parser by domain. An unmatched sender returns null; the
// caller marks that email needs_review with no fabricated fields (never guesses
// a parser). Pure: no I/O.

import { bcaParser } from "./bca";
import { gopayParser } from "./gopay";
import { shopeeParser } from "./shopee";
import type { GmailParser } from "./types";

export type { GmailParser, ParseResult } from "./types";
export { bcaParser } from "./bca";
export { gopayParser } from "./gopay";
export { shopeeParser } from "./shopee";

// Extract the lowercased domain from a From header, handling both
// "Display Name <user@domain>" and a bare "user@domain". Returns "" when no
// address is present so resolveParser falls through to null.
function extractDomain(sender: string): string {
  if (typeof sender !== "string") return "";
  const angle = sender.match(/<([^>]+)>/);
  const address = (angle ? angle[1] : sender).trim();
  const at = address.lastIndexOf("@");
  if (at === -1) return "";
  return address.slice(at + 1).toLowerCase();
}

/**
 * Resolve the parser for a sender's domain:
 *   *.bca.co.id              -> bcaParser
 *   *.shopee.co.id           -> shopeeParser
 *   *.gopay.co.id | gojek.com -> gopayParser
 *   anything else            -> null (caller marks needs_review)
 *
 * endsWith matching also covers sub-addresses like "mail.shopee.co.id".
 */
export function resolveParser(sender: string): GmailParser | null {
  const domain = extractDomain(sender);
  if (domain === "") return null;

  if (domain === "bca.co.id" || domain.endsWith(".bca.co.id")) {
    return bcaParser;
  }
  if (domain === "shopee.co.id" || domain.endsWith(".shopee.co.id")) {
    return shopeeParser;
  }
  if (
    domain === "gopay.co.id" ||
    domain.endsWith(".gopay.co.id") ||
    domain === "gojek.com" ||
    domain.endsWith(".gojek.com")
  ) {
    return gopayParser;
  }

  return null;
}
