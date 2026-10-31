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

Result: pending.
