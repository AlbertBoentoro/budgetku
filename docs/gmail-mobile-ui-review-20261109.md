# QA — Gmail mobile date and scrollable pending queue (2026-11-09)

## Scope
- Native iOS date input in Gmail approval / Catat must stay inside the field card at narrow widths.
- Transaksi shows approximately **3 pending Gmail entries** inside a bounded, independently scrollable list, while loading up to 100 pending drafts to scroll through.
- The **Lihat semua N draft Gmail** control stays outside the scroll region, has a full-width 44px+ touch target, and opens the complete review list (currently up to 100).
- Nested scroll should not activate AppFrame's global pull-to-refresh gesture.
- No change to financial transactions, amounts, approval rules, Gmail sync, database schema, or auth.

## Manual mobile verification (required before calling it visually verified)
1. On an iPhone-sized view, open a pending Gmail draft and scroll down to Tanggal. Its right edge must align with Rekening, Kategori, Toko, and Catatan inside the background; no sideways scrolling.
2. Check light and dark theme, text zoom, active input focus and the native date picker.
3. On Transaksi, verify that the Gmail panel begins with three compact drafts and **scrolls vertically on its own** to the remaining drafts.
4. Confirm the full-width **Lihat semua** control is visible without scrolling the internal draft region, opens the Gmail inbox, and that Accept/Decline still work.
5. Drag the pending list while the page is at the top; no global pull-to-refresh should trigger.
6. Recheck /transactions/new and edit: date control width and entered values unchanged.

## Automated checks
- `tests/gmail-date-and-pending-scroll.test.mjs` guards element constraints, scrolling, full-list CTA, per-user pending query, and nested pull-to-refresh exclusion.
- Existing Gmail approval tests updated for the increased limit.
- CI: Node tests, ESLint, TypeScript, Next.js production build, disposable PostgreSQL tests.
- Browser tests on an authenticated physical iPhone are not automatic and must be reported as unverified unless performed.
