# Delivery report: Material Symbols font subset (2026-11-01)

Mode: antislop DURING (chosen by the user earlier in this session).

Design Read: Reading this as the icon font loading for every Budgetku screen (all Material Symbols glyphs), Calm Ledger style from DESIGN.md, dial ENERGY 1 / RHYTHM 1 / MOTION 1. No visual change is intended; the goal is the same glyphs from a smaller file.

## Problem

Chrome Network showed a Material Symbols WOFF2 of about 4 MB. `app/layout.tsx` loaded the full variable font (`opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`) with no `icon_names`, so the browser downloaded all 4,304 icons in the codepoints file to show 70. Measured: 4,005,964 bytes.

## Audit

Method: a TypeScript AST scan of all 162 tracked source files found every `<Icon>` element, its `name`, `size`, `fill`, and `weight` props, and any use of `Icon` as a value. Every non-literal `name` was traced to its source by reading the code. Then a second AST pass listed every string literal in the source that is an official Material Symbols name but not in the traced list. All 16 such literals are non-icon values (`"class"`, `"code"`, `"create"`, `"filter"`, `"group"`, `"light"`, `"pending"`, `"public"`, `"schema"`, and similar).

- 51 files import `Icon` from `components/ui/icon.tsx`. No file uses the `material-symbols-outlined` class outside `Icon`, and nothing passes `Icon` as a value or spreads props into it.
- 44 names are string literals or literal conditionals (`expand_less`/`expand_more`, `visibility_off`/`visibility`, `error`/`mail`, `check`/`block`).
- The dynamic names all come from fixed sets:

  | Source | Names |
  |---|---|
  | `accountTypeGlyph` (`components/dashboard/dashboard-account-card.tsx`), used by Beranda, Rekening, and the Transaksi account banner | payments, account_balance, account_balance_wallet, credit_card, savings, trending_up; fallback account_balance_wallet |
  | `TRANSACTION_TYPE_GLYPH` (ledger row, recent row, recurring row) | arrow_downward, arrow_upward, swap_horiz; fallback swap_horiz |
  | `DRAFT_TYPE_GLYPH` (`gmail-import-review.tsx`) | arrow_downward, arrow_upward |
  | `getGoalGlyph` (`lib/goals.ts`) | savings, target, flight, school, home, redeem; fallback flag |
  | Theme options (`theme-setting-row.tsx`) | light_mode, dark_mode, desktop_windows |
  | Type switcher segments (`transaction-type-switcher.tsx`) | arrow_upward, arrow_downward, sync_alt |
  | Bottom nav items (`bottom-nav.tsx`) | home, receipt_long, pie_chart, credit_card (plus literal add) |
  | Quick actions (`quick-actions.tsx`) | savings, forward_to_inbox, analytics, event_repeat |
  | Wrapper props with literal call sites (EmptyPanel, LedgerEmptyState, ReportEmptyState, SettingsLinkRow, DownloadLinkRow, SummaryRow, SummaryPill, TrendRow, TransactionFieldRow) | account_balance_wallet, receipt_long, inbox, calendar_month, search_off, pie_chart, bar_chart, savings, category, event_repeat, mail, data_object, table_view, arrow_downward, arrow_upward, sync_alt, calendar_today, store, notes |

- No name comes from the database without a map: stored goal icons and account types go through the helpers above, and budget rows use a fixed glyph.
- No dynamic name was left unresolved, so there is no blocker.
- All 70 names exist in the official codepoints file for this font.

Complete list (70 names, deduplicated, sorted): account_balance, account_balance_wallet, add, analytics, archive, arrow_back, arrow_downward, arrow_forward, arrow_upward, backup, bar_chart, block, calendar_month, calendar_today, category, check, check_circle, chevron_left, chevron_right, close, credit_card, dark_mode, data_object, delete, desktop_windows, download, edit, error, event_repeat, expand_less, expand_more, flag, flight, forward_to_inbox, home, inbox, inventory_2, light_mode, lock, logout, mail, more_vert, notes, notifications, palette, payments, person, pie_chart, play_arrow, receipt_long, redeem, repeat, savings, school, search, search_off, settings, store, swap_horiz, sync, sync_alt, table_view, target, track_changes, trending_up, tune, unarchive, visibility, visibility_off, warning.

Axes in use: `size` is a literal on all 117 `<Icon>` elements (14, 16, 18, 19, 20, 22, 24, 26, 28), and `Icon` maps it to opsz. FILL is 0 everywhere except the active bottom nav item (`fill={active}`). No caller passes `weight`, so wght is 400, but the prop is part of the documented `Icon` API. GRAD is hardcoded to 0 in `Icon` and in `globals.css`.

## Change

- New `components/ui/material-symbols.ts`: the 70 names and the stylesheet URL. The URL keeps the original axis ranges and adds `icon_names` and `display=block`. The code deduplicates and sorts the names before joining them.
- `app/layout.tsx`: the stylesheet `<link>` uses that URL. The `eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font` line is removed: both rules read only string-literal `href` values (checked in `@next/eslint-plugin-next` 15.3.1), so they no longer apply and the directive would be reported as unused. The preconnect links are unchanged.
- `components/ui/icon.tsx`: the `name` doc comment says the name must be in that list. No behavior change.
- `DESIGN.md`, Icons section: describes the subset and how to add a glyph.
- Unchanged: `Icon` markup and props, `globals.css`, every screen, Supabase, auth, data, and money logic.

Original URL: `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`

Optimized URL (831 characters): the same family and axes, plus `&icon_names=<the 70 names>&display=block`.

## Payload

Font file for the Chrome, Chrome Android, Safari macOS, Safari iOS, and Firefox user agents (all get WOFF2):

| | Before | After | Saved |
|---|---|---|---|
| Font file (bytes, decoded) | 4,005,964 | 67,844 | 3,938,120 (98.3%) |
| Transfer in headless Chrome (encoded bytes) | 4,008,533 | 68,262 | |
| Stylesheet | 636 B, no font-display | about 800 B, `font-display: block` | |

Variants measured but not used:

- GRAD pinned at 0: 42,992 bytes. It looks the same at a glance, but the pixel comparison found 10,441 changed pixels (max delta 5/255) in 506 of 1,540 cells, so it is not identical. Rejected because the brief asks to keep the appearance.
- wght pinned at 400: 21,876 bytes. Rejected: the `weight` prop would stop working and the @font-face weight descriptor would change to 400.
- opsz limited to 20..28: 42,992 bytes with GRAD pinned, the same size as the full range, so no saving.
- Without the two QuickActions names: 66,596 bytes (1,248 bytes less). Kept, see findings.

## Google Fonts API behavior

- Unsorted names: HTTP 200 and the same font file as sorted names.
- A duplicate name: HTTP 400. The stylesheet would fail, and every icon would show as text. The code deduplicates, so this cannot happen through the list.
- An unknown name: HTTP 200, and the name is left out of the font.
- Caching: the full font had `max-age=31536000`. The subset font has `max-age=86400` with `Last-Modified`, and a conditional request returns 304 with an empty body. The stylesheet has `private, max-age=86400, stale-while-revalidate=604800`.
- `public/service-worker.js` has no fetch or cache handler, so no stale font is served from it.

## Checks run

- `npm run lint`: exit 0, no warnings.
- `npm run build` with the dev server stopped and `.next/dev/types` removed: exit 0. Route markers unchanged (6 static, 21 partial prerender, 10 dynamic). No preview route in the output.
- Rendered HTML of `/auth/login` on `next dev`: the stylesheet link and React's preload link both carry the new URL. The URL equals the measured one, with 70 unique sorted names and `display=block`. Both preconnect links are present.
- Appearance, headless Chrome 156, DevTools protocol (10/10): the original and the subset font files were rendered with the markup `Icon` produces. The test covered 70 names x 22 variants (9 sizes x FILL 0/1 at wght 400, plus wght 100 and 700 at 24px) = 1,540 cells per font.
  - Every span is one glyph, 1em wide, and drawn by Material Symbols Outlined (`CSS.getPlatformFontsForNode`, glyphCount 1) in both fonts.
  - Pixel comparison at device scale 2 (4480x1408 px): 0 different pixels.
  - Control 1: the original font at GRAD 200 differs in all 1,540 cells, so the comparison does catch outline changes.
  - Control 2: an unlisted name ("star") renders as the letters STAR (4 glyphs, 96px wide) with the subset font.
- In the app (56/56): a temporary preview route `/auth/kiro-icon-preview` (deleted afterwards) rendered the real `Icon` and real components with demo data:
  - Components: TransactionFilters, NetBalanceCard, LedgerSummaryPill, ReportSummaryCard, AccountSummaryCard, DashboardAccountCard for six account types plus an unknown type, `getGoalGlyph` for six goal icons plus null and an unknown value, TransactionDayGroups with income, expense, transfer, and an unknown type, ThemeSettingRow, BottomNav, and AppBackLink.
  - A matrix of all 70 names x 9 sizes x FILL 0/1.
  - Runs: 375px light, 375px dark, 1280px light, 1280px dark, each with a fresh browser profile. Each run checked:
    1. The theme applied.
    2. The font face loaded with `display: block`, and the stylesheet response is 200 with `font-display: block` and the class rule.
    3. Exactly one font file was downloaded, the subset (68,262 bytes), and not the full font.
    4. All 1,306 icon elements are listed names, are 1em wide, and are drawn by Material Symbols Outlined with glyphCount 1. The real components rendered 46 of them, with 29 distinct names, including the fallbacks flag, swap_horiz, and account_balance_wallet.
    5. The "star" control is not drawn as an icon.
    6. No horizontal overflow and no console errors.
- Screenshots reviewed at 375px in both themes, plus the bottom nav and the 1280px dark matrix: icons, colors, and sizes match the expected glyphs. The bottom nav overlaps content in the tall captures only because it is fixed to the viewport.

## Not verified

- The real signed-in screens. Every screen that uses icons is behind login, and this environment has no session. The components above stand in for them.
- Rendering in Safari, Firefox, and on real phones. For those user agents only the API responses were checked: the same 67,844-byte WOFF2 and `font-display: block`.
- Slow networks. With `display=block` an icon stays blank for up to about 3 seconds and then falls back to its letters; this was not simulated. The original URL had no font-display, which browsers treat as `auto`, about the same as block in Chrome.
- The active bottom nav state on a real route. FILL 1 rendering of all 70 names was checked in the matrix and in the pixel comparison instead.

## Remaining risks

- A new icon name must be added to `components/ui/material-symbols.ts`. Otherwise it shows as its letters. Nothing checks this automatically.
- The subset depends on Google's dynamic `/l/font?kit=` endpoint. If Google renames or drops a name, that icon silently disappears from the font.
- The subset font is cached for 1 day instead of 1 year, so repeat visits after a day make one revalidation request (304, no body). Changing the list changes the URL, so browsers download the new subset once (about 68 KB).

## Findings outside this change

- `components/dashboard/quick-actions.tsx` (`QuickActions`) is not imported anywhere. Its names `analytics` and `forward_to_inbox` stay in the list so the component still works if it is used again. Removing them saves 1,248 bytes.

## Delivery Gate

- Block 1, Hard Gate (all answers no): R-02 no em dash in the new code, comments, or this report. R-03 no overflow at 375 and 1280px. R-25 no color changed. R-26 no control changed. R-27 states untouched. R-32 no focus or markup change. R-33 no source patched by script; the edits are in source. R-34 both themes rendered and checked. R-35 build run and the in-app check recorded; signed-in screens open. R-37 DESIGN.md. R-17, R-18, R-23, R-24, R-28, R-36, R-38: not applicable, none present.
- Block 2, Purpose-Gate: no icon added, removed, or replaced; every glyph keeps its existing meaning.
- Block 3, Liveliness: dials unchanged; no new motion. The pixel comparison shows the glyphs are identical.
- Block 4, Craftsmanship: C-1 each decision has a reason above (axes kept, list sorted and deduplicated in code, display=block). C-2 no dead controls. C-3 no new section. C-4 both themes, two widths, all sizes, and both FILL states checked. C-5 every number above was measured.

Verdict: PASS for the font change as checked in Chrome. Open: a signed-in check of the real screens, plus Safari, Firefox, and iOS.
