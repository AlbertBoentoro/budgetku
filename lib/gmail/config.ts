/**
 * Pure Gmail import configuration constants. No secrets, no Node-only imports,
 * no I/O — safe to import from anywhere, kept under lib/gmail/ for cohesion.
 *
 * Best-effort notice: the sender identities and the list query below target
 * Indonesian financial senders (BCA, Shopee/ShopeePay, GoPay). Real sender
 * addresses and email formats drift over time, so these are deliberately kept
 * editable here and are only ever confirmed against a live inbox.
 */

// OAuth scopes requested at consent. Read-only Gmail plus the connected email
// address. `openid` is intentionally NOT requested: the connected address is
// read from the userinfo endpoint, so an ID token is never consumed.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

// Known/representative sender identities. Best-effort and may need updating;
// real addresses are only confirmed against a live inbox.
export const GMAIL_SENDERS = {
  bca: ["bca@bca.co.id", "noreply@bca.co.id", "halobca@bca.co.id"],
  shopee: [
    "no-reply@shopee.co.id",
    "noreply@shopee.co.id",
    "no-reply@mail.shopee.co.id",
  ],
  gopay: ["noreply@gopay.co.id", "no-reply@gopay.co.id", "noreply@gojek.com"],
} as const;

// Gmail list query: OR of the known from-domains, excluding chats/spam/trash.
// The incremental `after:<epoch>` narrowing is appended at call time. The query
// filters by sender domain, so it may also pull non-transactional mail from
// those domains; such mail parses to failed/low-confidence and is reviewed by
// the user rather than silently dropped.
export const GMAIL_BASE_QUERY =
  "(from:bca.co.id OR from:shopee.co.id OR from:mail.shopee.co.id OR from:gopay.co.id OR from:gojek.com) " +
  "-in:chats -in:spam -in:trash";

// Upper bound on messages fetched per manual sync, to bound work and API usage.
export const MAX_MESSAGES_PER_SYNC = 50;

// httpOnly, single-use cookie holding the CSRF state during the OAuth round-trip.
export const GMAIL_OAUTH_STATE_COOKIE = "gmail_oauth_state";

// Settings-managed route the connect/callback flow redirects back to.
export const GMAIL_SETTINGS_PATH = "/settings/gmail";
