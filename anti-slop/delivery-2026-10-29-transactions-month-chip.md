# Delivery report: Transaksi month chip (2026-10-29)

Mode: antislop DURING (chosen by the user in this session).

Design Read: Reading this as the Transaksi ledger filter row of a personal finance app for Indonesian users, in the Calm Ledger style from DESIGN.md, dial ENERGY 1 / RHYTHM 1 / MOTION 1.

## Problem

The "Bulan Ini · Oktober 2026" chip was a `<span>` with `cursor-default`. It looked like the other chips but did nothing when tapped. The only month control was the Bulan field inside the Filter panel.

## Change

File: `components/finance/transaction-filters.tsx`.

- The chip is now a `<button>`. It opens the Filter panel, moves focus to the existing Bulan field, and calls `showPicker()` when the browser has a month picker. Browsers that render `type="month"` as a text field get the focused field instead.
- While a month filter is set, the chip uses the same filled style as the selected type chip. The label already changes from "Bulan Ini · <bulan>" to the month name, so the state is not shown by color alone.
- Accessible name: "Ganti bulan: <label>". It contains the visible label.
- Unchanged: URL handling (`?month=YYYY-MM` through the existing `updateParam`), queries, calculations, and other pages.

## Checks run

- `npm run lint`: exit 0.
- `npm run build`: exit 0. Route markers unchanged (6 static, 21 partial prerender, 10 dynamic); `/transactions` stays partial prerender.
- `git diff`: no em dash in added lines.
- Contrast with `.agents/skills/antislop-human/contrast-check.py` (WCAG 2.x). All pass:

  | Pairing | Light | Dark |
  |---|---|---|
  | Active chip text on its fill | 17.85:1 | 12.02:1 |
  | Inactive chip text on its fill | 6.92:1 | 8.35:1 |
  | Inactive chip text on hover fill | 6.15:1 | 6.97:1 |
  | Active fill vs page background (state, 3:1) | 17.06:1 | 12.02:1 |
  | Focus ring vs page background (3:1) | 17.06:1 | 12.02:1 |

  The dark inactive fill `--surface-container` (215 28% 22%) was converted to #283548.
- Browser click-through: UNVERIFIED. There is no local browser automation, and the page needs a signed-in Supabase session that this environment does not have.

## Delivery Gate

### Block 1: Hard Gate (all answers must be no)

- R-02 em dash: no.
- R-03 mobile overflow: no new layout. The chip keeps `h-11` (44px) inside the existing `flex-wrap` row. Visual check at phone width UNVERIFIED.
- R-17 unsourced numbers: no.
- R-18 testimonials: no.
- R-23 assets created without confirmation: no.
- R-24 dead nav links: no.
- R-25 contrast below AA: no (table above).
- R-26 dead controls: no. Before this change the chip was a dead control that looked interactive; it now opens the month field.
- R-27 missing states: no. The ledger empty, loading, and error states are untouched.
- R-28 generic FAQ: no.
- R-32 keyboard: by code, the button is in the Tab order, activates with Enter or Space, keeps the `focus-visible` ring from `chipBase`, and moves focus to the labeled Bulan field. Not exercised in a browser: UNVERIFIED.
- R-33 patching by script: no.
- R-34 theme breaks: tokens only, contrast passes in both themes. Visual check UNVERIFIED.
- R-35 run and click-through: build run; click-through NOT recorded. Open.
- R-36 fabricated claims: no.
- R-37 direction: DESIGN.md (Calm Ledger).
- R-38 fabricated content: no.

### Block 2: Purpose-Gate

- R-04 icons: no new icon. The existing `calendar_month` Material Symbol marks the date filter.
- R-08 decorative arrows: none added.
- R-01, R-06, R-07, R-09, R-10, R-12, R-13, R-14, R-19, R-22: not used by this change.

### Block 3: Liveliness

- Dials declared: yes, ENERGY 1 / RHYTHM 1 / MOTION 1. DESIGN.md asks for a calm, precise character with motion at feedback level.
- Output matches the dials: yes. No new motion; the existing chip style is reused.
- Focal point, structural whitespace, accent, identity motif: yes, unchanged. The filled state reuses the navy accent only for an active filter.
- Design Read declared: yes (above).

### Block 4: Craftsmanship & Quality Locks

- C-1 intentionality: the button, the filled state, and the text-field fallback each have a written reason above.
- C-2 functional completeness: no dead control left in the chip row.
- C-3 content-driven composition: no new section.
- C-4 resilience: keyboard and both themes handled in code; breakpoints and live behavior UNVERIFIED.
- C-5 evidence over claims: no claims.
- R-05, R-11, R-15, R-16, R-20, R-21, R-29, R-30, R-31: not changed. The existing chip radius and tokens are reused.

## Verdict

Not a full PASS. The change is implemented and statically verified. R-35 (click-through), the R-03 and R-34 visual checks, and live R-32 keyboard use stay UNVERIFIED until someone checks them in a browser with a signed-in session. Until then the UI is incomplete.

## Click-through to record after deploy

1. Transaksi, light theme, desktop: tap "Bulan Ini · Oktober 2026". The Filter panel opens, the Bulan field has focus, and the month picker opens.
2. Pick September 2026. The URL gets `?month=2026-09`, the chip reads "September 2026" in the filled style, and the summary and list show September.
3. With the panel still open, tap the chip again. The picker opens again.
4. Use "Atur ulang filter". The chip returns to "Bulan Ini · Oktober 2026".
5. Keyboard only: Tab to the chip and press Enter. Focus moves to Bulan and the picker opens; Escape closes it.
6. Dark theme and a phone width (about 375px): the chip is readable, the row wraps without horizontal overflow, and tapping works.

Result: superseded by iteration 2 below. The chip no longer opens the Filter panel.

## Iteration 2 (2026-10-31): month picker panel

Request: replace the browser's default month picker with a nicer one, and show only months (no Rekening or Kategori) when choosing a month.

Design Read: unchanged. Transaksi ledger filter row, Calm Ledger style from DESIGN.md, dial ENERGY 1 / RHYTHM 1 / MOTION 1.

### Change

- New `components/finance/month-picker-panel.tsx`: a bordered panel with year arrows and a 12-month grid (Jan to Des, Indonesian short names).
  - The selected month uses the navy fill (`aria-pressed="true"`). The current month keeps a `--input` outline (`aria-current="date"`).
  - "Tampilkan semua bulan" clears the month filter. It appears only while a month is selected.
  - Opening the panel moves focus to the selected month, or to the current month when none is set. Escape closes it and returns focus to the chip.
  - Month buttons and year arrows get an `active:` fill as tap feedback.
- `components/finance/transaction-filters.tsx`:
  - The month chip opens the picker instead of the Filter panel. It has `aria-expanded` and an `expand_more`/`expand_less` icon that shows the open state.
  - Default chip label is "Semua bulan" instead of "Bulan Ini · <bulan>". Without `?month=` the list shows every month and only the summary covers the current month, so the old label described a filter that was not applied.
  - The Filter panel keeps Rekening, Kategori, and "Atur ulang filter". The native `type="month"` field and the `showPicker()` code from iteration 1 are removed. Only one panel is open at a time.
  - Both panels use `border-outline-variant bg-surface-container-lowest p-4`. The old Filter panel used `p-space-md`, which is not a class in this Tailwind config (the spacing key is `md`), so it had no padding. Its light-mode fill also matched the page background.
  - `chipBase` gains `focus-visible:ring-offset-2 focus-visible:ring-offset-background`. A filled chip has the same color as the focus ring, so the ring was not visible on it before.
  - The current month is read when the picker opens, not during render. The chip no longer calls `activeMonthFrom` during render.
- Unchanged: `?month=YYYY-MM` handling, queries, calculations, the summary, and other pages.

### Checks run

- `npm run lint`: exit 0. `tsc --noEmit`: exit 0.
- `npm run build` with the dev server stopped: exit 0. Route markers unchanged (6 static, 21 partial prerender, 10 dynamic), and `/transactions` stays partial prerender. The working tree also held the user's uncommitted auth patch (12 files) and an edit to `docs/sql/2026-10-add-gmail-parsed-preview.sql`. They were part of this build but are not part of this change.
- Contrast with `contrast-check.py` (WCAG 2.x). All pass:

  | Pairing | Light | Dark |
  |---|---|---|
  | Month text on panel | 17.85:1 | 17.73:1 |
  | Month text on hover fill | 16.30:1 | 11.86:1 |
  | Month text on pressed fill | 14.48:1 | 9.90:1 |
  | Selected month text on its fill | 17.85:1 | 12.02:1 |
  | Selected fill vs panel (state, 3:1) | 17.85:1 | 12.50:1 |
  | Current-month outline vs panel (3:1) | 4.76:1 | 7.24:1 |
  | Year arrows and "Tampilkan semua bulan" on panel | 7.58:1 | 12.50:1 |
  | Year arrow on pressed fill | 6.15:1 | 6.97:1 |
  | Focus ring vs panel (3:1) | 17.85:1 | 12.50:1 |
  | Chip focus ring vs page (3:1) | 17.06:1 | 12.02:1 |

  The panel border against the page is 1.18:1 (light) and 1.72:1 (dark). It is a non-essential grouping hairline like the ledger summary card, not a control boundary; the controls inside are identified by their text or by `--input` borders.
- Browser click-through: headless Chrome 156 driven over the DevTools protocol, against `next dev`. The component ran on a temporary preview route (`/auth/kiro-month-preview`, deleted afterwards) that rendered `TransactionFilters` with empty account and category lists. 120 checks, 0 failures, in four runs: 320px light, 375px dark, 1280px light, 1280px dark. Each run checked:
  1. Theme applied, default chip reads "Semua bulan", no `input[type=month]` on the page, no horizontal overflow.
  2. Keyboard: Enter on the chip opens the picker; focus lands on Oktober 2026 (the current month) with `:focus-visible`; 12 month buttons and no selects; every month button at least 44x44px; no overflow with the panel open; inner padding present; panel width 288px at 320, 343px at 375, capped at 384px at 1280; 3 columns below 375px and 4 from 375px; Escape closes it and focus returns to the chip.
  3. Pointer: the chip opens the picker; "Tahun sebelumnya" shows 2025 and "Tahun berikutnya" returns to 2026; September 2026 sets `?month=2026-09`, the chip reads "September 2026", and the picker closes.
  4. Reopened: September is `aria-pressed="true"`; "Tampilkan semua bulan" removes `?month` and the chip reads "Semua bulan" again.
  5. Filter chip: closes the month picker and shows only Rekening and Kategori (2 selects) with inner padding.
  6. With `?month=2026-09`, the filled chip shows a visible focus ring.
  7. Console: no errors except the `manifest.webmanifest` redirect (see findings), 8 to 10 per run.
- All 24 screenshots were reviewed for padding, wrapping, grid width, and both themes. The first review found the missing padding and the over-wide desktop grid; both were fixed before the final run. Two screenshots were shared in the chat; the files were deleted with the preview route.

### Not verified

- The real `/transactions` page with a signed-in session: the summary and list following the chosen month. This needs the user's browser session.
- Safari, Firefox, and real touch devices. Chrome device emulation was driven with mouse events.
- Screen reader output.

### Findings outside this change

- `/manifest.webmanifest` redirects to `/auth/login` for visitors who are not signed in, in production too (`curl` returned 307). The public paths in `lib/supabase/proxy.ts` do not include it, so the login page has no valid PWA manifest. Fixing it touches the auth proxy.
- `px-space-xs` and `px-space-md` in `app/(app)/transactions/loading.tsx` and `components/transactions/transaction-day-groups.tsx` are not Tailwind classes in this config, so that padding is missing. The chip row's `-mx-space-xs px-space-xs` are also no-ops, but they would cancel each other anyway.
- Default list scope: without `?month=` the ledger lists every month while the summary covers the current month. Making the list default to the current month is a product decision and would also change search results and the first-run empty state.

### Delivery Gate (iteration 2)

Block 1, Hard Gate (all answers no):
- R-02: no em dash in the new copy or comments.
- R-03: no overflow at 320, 375, or 1280px; all targets at least 44px; the chip row wraps and the panels stack.
- R-25: contrast table above.
- R-26: every control acts (chip, year arrows, 12 months, "Tampilkan semua bulan", Filter), per the click-through.
- R-27: ledger states untouched; the picker is not a data view.
- R-32: Tab, Enter, and Escape work, and focus is visible, including on filled chips and the selected month (ring offset).
- R-34: both themes rendered and checked.
- R-35: build run and click-through recorded above. The signed-in page check is still open.
- R-37: DESIGN.md.
- R-17, R-18, R-23, R-24, R-28, R-33, R-36, R-38: not applicable, none present.

Block 2, Purpose-Gate: `calendar_month` marks the date filter; `expand_more`/`expand_less` shows that the chip opens a panel and whether it is open; `chevron_left`/`chevron_right` step the year. No decorative arrows (R-08). R-01, R-06, R-07, R-09, R-10, R-12, R-13, R-14, R-19, R-22: not used.

Block 3, Liveliness: dials declared and held. No motion beyond color transitions. One accent: the navy fill marks the selected month and active chips. The pill chip and navy-fill state are reused as the motif. Design Read declared.

Block 4, Craftsmanship: C-1 reasons written above. C-2 no dead controls (the dead span and the duplicate native field are gone). C-3 no new section. C-4 states, both themes, three widths, and keyboard checked. C-5 no claims. R-11: chips stay pill-shaped, months use `rounded-lg`, panels `rounded-xl`, all from the existing scale. R-29: palette unchanged.

Verdict: PASS for the month picker as checked in Chrome on the preview route. Open: a signed-in check of the real Transaksi page, plus Safari and iOS.

## Iteration 3 (2026-10-31): centered picker, current month by default

Request: the user checked iteration 2 on production and confirmed it works. They asked to show the picker in the center instead of the left corner, and chose to make the ledger list the current month by default.

### Change

- `components/finance/month-picker-panel.tsx`: `mx-auto`, so the panel is centered under the chip row (384px on wide screens, full width on phones). The `onClear` prop is now `onShowAll`.
- Ledger default (`app/(app)/transactions/page.tsx`, `lib/transactions.ts`):
  - Without `?month=` the list shows the current month (`resolveListMonth`). `?month=YYYY-MM` shows that month, and `?month=all` shows every month.
  - The summary covers the listed month, or the current month while every month is listed.
  - Empty states: a user without any transaction still gets the first-run state. `hasAnyTransaction` checks this only when the month is empty and no other filter is set. A user with transactions in other months gets "Belum ada transaksi di <bulan>" with "Tampilkan semua bulan". The account-only and filtered states name the month and offer "Tampilkan semua bulan" or "Cari di semua bulan".
  - Clearing the account filter keeps the month scope. The account-not-found notice now says "Menampilkan transaksi semua rekening".
  - `activeMonthFrom` was replaced; this page was its only caller.
- `components/finance/transaction-filters.tsx`: takes `currentMonth` from the server render, so the chip, the picker, and the list agree on the month, with no clock read in the client. Chip labels: "Bulan Ini · <bulan>" for the default (not filled), "<bulan>" for an explicit month (filled), "Semua bulan" (filled). Picking the current month removes `?month=`; "Tampilkan semua bulan" sets `?month=all`.
- `components/finance/transaction-form.tsx` and the new and edit pages: after saving, the form opens the month of the saved transaction (`/transactions?month=YYYY-MM`), or the default view when it is the current month. A backdated transaction stays visible after saving.
- Unchanged: the money math, the query per month, and the database.

### Checks run

- `npm run lint`: exit 0. `tsc --noEmit`: exit 0.
- `npm run build` with the dev server stopped. The first attempt failed with TS2307 on stale route types in `.next/dev/types` that still listed the deleted preview route. After removing the generated `.next/dev/types`, exit 0. Route markers unchanged (6 static, 21 partial prerender, 10 dynamic); `/transactions`, `/transactions/new`, and `/transactions/[id]/edit` stay partial prerender. The working tree again held the user's uncommitted auth patch, which is not part of this change.
- Contrast: no new color pairings; the tokens and pairings from iteration 2 apply.
- Browser click-through: headless Chrome 156 against `next dev` on a temporary preview route with `currentMonth="2026-10"` (deleted afterwards). 104 checks, 0 failures, at 320px light, 375px dark, 1280px light, and 1280px dark. Each run checked:
  1. Default chip reads "Bulan Ini · Oktober 2026" and is not filled; no horizontal overflow.
  2. Enter opens the picker with Oktober selected and focused (`:focus-visible`), and "Tampilkan semua bulan" offered.
  3. Panel centered: center offset 0px in all four runs; 384px of 736px at 1280; full width (288px, 343px) on phones. Month buttons at least 44x44px; no overflow with the panel open. Escape closes it and focus returns to the chip.
  4. September sets `?month=2026-09` and the chip reads "September 2026", filled. Oktober then removes `?month` and the chip returns to the default label, not filled.
  5. "Tampilkan semua bulan" sets `?month=all` and the chip reads "Semua bulan", filled. In that mode no month is selected, the footer button is hidden, and Oktober is still marked as the current month. Oktober returns to the default view.
  6. The Filter chip shows only the two selects and no picker.
  7. Console: no errors except the `manifest.webmanifest` redirect, 7 or 8 per run.
- Screenshots reviewed: the panel is centered in both themes on phone and desktop.

### Not verified

- The server side with a signed-in session: the ledger listing only the current month, the summary, the empty-month and first-run states, the account history, and the redirect after saving. These need the user's session.
- Safari, Firefox, iOS, and screen readers.

### Known limitations

- "This month" uses the server clock (UTC on Vercel), like the summary, dashboard, and budget. From 00:00 to 07:00 WIB on the 1st, the default view is still the previous month.
- Search covers the listed month. In an empty result, "Cari di semua bulan" widens it to every month.
- The account "Riwayat transaksi" links also open on the current month.

### Delivery Gate (iteration 3)

- Block 1, Hard Gate (all answers no): R-03 no overflow at three widths and all targets at least 44px. R-25 no new pairings. R-26 every control acts. R-27 the empty-month and first-run states are distinct, the filtered state names the month, and loading and error are untouched. R-32 keyboard path checked. R-34 both themes checked. R-35 click-through recorded; the signed-in server check is open. R-02 no em dash; the "·" in the chip label is a middle dot. The others do not apply.
- Block 2, Purpose-Gate: the empty-month state uses `calendar_month`, the same glyph as the month chip. No decorative arrows.
- Block 3, Liveliness: dials unchanged; no new motion.
- Block 4, Craftsmanship: C-1 reasons written above. C-2 no dead controls. C-3 no new section; the new empty states replace existing ones. C-4 states, themes, widths, and keyboard checked. C-5 no claims.

Verdict: PASS for the client UI as checked in Chrome.

Result after deploy (2026-10-31): deployed as `4bad11b` (`dpl_61isnoyf7xfoL4fQECJUaEc5em6p`). The user ran the five signed-in steps on production and confirmed that all of them match: the list and summary show the current month by default, the centered picker switches to September, "Tampilkan semua bulan" lists every month, an empty month shows the empty-month state, and saving a backdated transaction opens its month. Still not verified: Safari, Firefox, iOS, and screen readers.

## Follow-up (2026-10-31): the six open items

Request: after the explanation of the open items, the user replied "deploy semua". For item 1 the recommended option (discard) was applied, in a recoverable way.

### Changes

1. Auth patch (12 files, `getAuthenticatedUser()`) and 2. the two patch scripts (`budgetku_fix_auth_latency.py`, `budgetku_fix_auth_latency_fixed.py`): set aside with `git --literal-pathspecs stash push -u` as `stash@{0}` ("Budgetku: patch auth getAuthenticatedUser + 2 skrip Python (disisihkan 2026-10-28)"). The stash holds exactly those 14 files. The working tree is back to the committed auth code: the layout uses `getClaims()` and the pages use `getUser()`. `git stash pop` restores both. Reason: the project signs JWTs with ES256 (public JWKS) and `@supabase/auth-js` 2.117.3 caches the key for 10 minutes, so the old layout check made no network call. The patch kept 1 Auth call on the list pages and made 2 on the form pages.
3. `docs/sql/2026-10-add-gmail-parsed-preview.sql`: restored with `git restore`. The file ends with a newline again.
4. `lib/supabase/proxy.ts`: `/manifest.webmanifest` (exact match) joins the public paths. The manifest has no user data. Its icons are `.png` files, which the proxy matcher already skips.
5. Padding classes:
   - `components/transactions/transaction-day-groups.tsx`: day header `px-space-xs` to `px-xs` (4px, the intended value).
   - `app/(app)/transactions/loading.tsx`: skeleton day header `px-xs`; skeleton row `px-space-md` to `px-4`, the padding of the real `TransactionLedgerRow`, so the skeleton matches the row it stands in for; the two text bars get `max-w-full`.
   - `components/finance/transaction-filters.tsx`: `-mx-space-xs` and `px-space-xs` removed from the chip row. As valid classes they would cancel each other, and the row wraps instead of scrolling, so they had no job.
6. This report.

Design Read (item 5): reading this as the Transaksi ledger (day headers, loading skeleton, chip row) of a personal finance app for Indonesian users, in the Calm Ledger style from DESIGN.md, dial ENERGY 1 / RHYTHM 1 / MOTION 1.

### Checks run

- Before the change, the CSS of the previous build had no rule for `space-xs` or `space-md`, which confirms the old classes did nothing.
- `npm run lint`: exit 0. `npx --no-install tsc --noEmit`: exit 0.
- `npm run build` with the dev server stopped (after removing the generated `.next/dev/types`): exit 0. Route markers unchanged (6 static, 21 partial prerender, 10 dynamic). `/transactions` stays partial prerender and `/manifest.webmanifest` is static. The new CSS has `.px-xs` and `.max-w-full` and no `space-` rule.
- `curl` against `next dev`, signed out: `/manifest.webmanifest` 200 `application/manifest+json`; the three icons 200; `/manifest.webmanifestx` 307; `/dashboard` and `/transactions` 307 to `/auth/login`; `/service-worker.js` 200; `/auth/login` 200.
- Browser: headless Chrome 156 over the DevTools protocol against `next dev`, on a temporary preview route (`/auth/kiro-padding-preview`, deleted afterwards). It rendered the real `TransactionFilters`, `TransactionDayGroups` with demo rows (largest: -Rp 123.456.789.012), and `TransactionsLoading`. Runs at 320px light, 375px dark, 1280px light, and 1280px dark, plus the login page. Final run: 123 of 124 checks passed.
  - Changed elements, 96/96: day header padding 4px with the label and the amount 4px inside the card edge, no overlap, amount not clipped (at 320px the label wraps to two lines next to -Rp 123.444.443.342); skeleton header 4px; skeleton rows 16px with the avatar at the same 16px inset as the real row icon; skeleton bars inside their column; chip row without margin or horizontal padding and aligned with the content edge; chips at least 44px tall; Tab reaches the first chip, which shows its `focus-visible` ring, not clipped by any ancestor.
  - Page, 12/12: theme applied, no horizontal overflow, no console errors. Earlier runs logged 7 to 10 manifest errors each.
  - Manifest on `/auth/login`, signed out, 4/4: `Page.getAppManifest` reports `/manifest.webmanifest` with no parse errors and the Budgetku body; no console errors.
  - Context, 11/12: the one failure is in the unchanged ledger row (see findings).
  - The first run found the skeleton text bars (`w-36`) running into the amount bar at 320px once the row had its 16px padding. `max-w-full` fixed it, and the rerun passed.
- Screenshots reviewed at 320px light and 375px dark: header insets, skeleton insets, and the chip row match the measurements.

### Not verified

- The real Transaksi page and its loading state with a signed-in session.
- Installing the app from the login page on a phone.
- Safari, Firefox, iOS, and screen readers.

### Findings outside this change

- `components/transactions/transaction-ledger-row.tsx` at 320px: a 12-digit amount (-Rp 123.456.789.012) is wider than the space left beside the icon and the menu. It runs outside its link and hides the merchant and category. Rp 12.345.670 fits. The row component was not changed.

### Delivery Gate (follow-up)

- Block 1, Hard Gate (all answers no): R-02 no em dash in the new code or comments. R-03 no overflow at 320, 375, or 1280px; chips at least 44px. R-25 no new color pairing, only padding. R-26 no control changed; the chips act as before. R-27 the loading state now matches the real row inset; empty and error states untouched. R-32 Tab reaches the chips with a visible, unclipped ring. R-34 both themes checked. R-35 build and click-through recorded; the signed-in check is open. R-37 DESIGN.md. The others do not apply.
- Block 2, Purpose-Gate: no new icon, arrow, or decoration.
- Block 3, Liveliness: dials unchanged; no motion added.
- Block 4, Craftsmanship: C-1 each class change has its reason above. C-2 no dead controls. C-3 no new section. C-4 loading state, both themes, three widths, and keyboard checked. C-5 no claims.

Verdict: PASS for the changed elements as checked in Chrome on the preview route. Open: the signed-in check of the real page, plus Safari and iOS.

Result after deploy (2026-10-31): deployed as `a69a3e0` (`dpl_BqqmAxQUTKxUTt1C5jfvFNvdTnGK`), READY and aliased to budgetku-weld.vercel.app. Signed-out `curl` on production: `/manifest.webmanifest` 200 `application/manifest+json` (before: 307 to `/auth/login`); the three icons 200; `/manifest.webmanifestx`, `/dashboard`, and `/transactions` 307 to `/auth/login`; `/service-worker.js` and `/auth/login` 200. The deployed CSS has `.px-xs` and `.max-w-full` and no `space-` rule. Vercel runtime errors in the 15 minutes after the deploy: none. Still open: the signed-in look of the day headers and the loading state, installing from the login page on a phone, and Safari and iOS.
