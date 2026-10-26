# Budgetku design direction

## Source and status
The active direction is **Calm Ledger** — clean white surfaces on a neutral Slate ramp with navy / emerald / red accents. It supersedes the earlier light-blue Stitch surface family (the token NAMES from that step are retained; only the values changed) and the original minimal black/white/neutral direction. The anti-slop honesty principles are retained: meaning is never carried by color alone, controls exist only where the feature exists, and sample data is labeled as demo. Indonesian copy and IDR `Rp` presentation are unchanged.

Status: the **foundation** (tokens, Inter font, Material Symbols icon infrastructure, globals base layer, and the global shell — Beranda header, bottom nav, page container) is implemented on the Calm Ledger palette. Individual feature screens are NOT yet converted; they still render with the previous classes and lucide icons but inherit the new palette through the shared tokens, and migrate per-screen in later steps. Light is the shipped target; the dark theme is a provisional non-audited approximation (see below).

## Identity and audience
Budgetku helps Indonesian users understand everyday personal finances. Character: calm, precise, approachable. The current visual language is **Calm Ledger**: clean white surfaces on a neutral Slate ramp (no blue tint), a prominent navy Rupiah balance, restrained emerald/red accents, and readable transaction rows. This supersedes the earlier light-blue Stitch surface family.

## Token system
Tokens live in `app/globals.css` as `H S% L%` triplets and are consumed via `hsl(var(--x))` in `tailwind.config.ts`, the globals `<select>` base rule, and chart `fill="hsl(var(--income))"`. Each triplet is converted from an authoritative Calm Ledger hex, noted inline in `globals.css`. This keeps one consistent approach (HSL triplets) and avoids churn to chart/base-layer consumers. Token NAMES are unchanged from the Stitch step; only the VALUES moved to Calm Ledger.

### Calm Ledger → project semantic mapping (light)
Palette: navy `#0F172A`, emerald `#059669`, red `#DC2626`, slate neutrals, on a clean Slate ramp (`50 #F8FAFC`, `100 #F1F5F9`, `200 #E2E8F0`, `300 #CBD5E1`, `400 #94A3B8`, `500 #64748B`, `600 #475569`, `700 #334155`, `800 #1E293B`, `900 #0F172A`).
- `--background` / `--surface` ← slate-50 `#F8FAFC`; cards (`--card` / `--popover` / `--surface-container-lowest`) ← `#FFFFFF`
- `--foreground` / `--on-surface` ← slate-900 `#0F172A`
- `--primary` / `--ring` / `--surface-tint` ← navy `#0F172A`; `--primary-foreground` / `--on-primary` ← `#FFFFFF`
- `--secondary` ← emerald `#059669`; `--secondary-foreground` ← `#FFFFFF`
- `--muted` / `--accent` / `--surface-container` ← slate-100 `#F1F5F9`; `--muted-foreground` / `--on-surface-variant` ← slate-600 `#475569`
- `--destructive` / `--error` ← red `#DC2626`; `--destructive-foreground` ← `#FFFFFF`
- `--border` / `--outline-variant` / `--surface-container-high` ← slate-200 `#E2E8F0`; `--input` ← slate-500 `#64748B` for visible control boundaries; `--outline` ← slate-400 `#94A3B8`
- Surface scale: `low ← #F8FAFC`, `container ← #F1F5F9`, `high ← #E2E8F0`, `highest ← #CBD5E1`, `bright ← #FFFFFF`, `dim/variant` as above
- `--income` ← emerald-700 `#047857`, `--expense` ← red-700 `#B91C1C` (AmountText TEXT tone; always paired with sign/label)

**Fill vs text contrast decision (D3).** The bright accents `#059669` (emerald) and `#DC2626` (red) are kept for FILLS with white text (buttons, chips, raised nav). But small TEXT needs AA 4.5:1 on white, and `#059669` text on white is only ~3.8:1. So the finance TEXT tokens are darkened: `--income` = emerald-700 `#047857` (5.48:1 on white, 5.24:1 on slate-50 — PASS) and `--expense` = red-700 `#B91C1C` (6.47:1 on white, 6.18:1 on slate-50 — PASS). Measured ratios (WCAG 2.x): on-surface `#0F172A` on `#F8FAFC` 17.06:1; on-surface-variant `#475569` on white 7.58:1; red fill `#DC2626` + white text 4.83:1 (PASS); emerald fill `#059669` + white text 3.77:1 (large/bold only — use on bold button text, not small labels). `--input` `#64748B` on white is 4.76:1, so input and outline-button edges remain visible; `--outline` `#94A3B8` on white is 2.56:1 and remains limited to non-essential hairlines.

The additive role tokens remain available as Tailwind classes verbatim: the `surface-container-*` scale, `surface-bright/dim/variant/tint`, `on-surface` / `on-surface-variant`, `outline` / `outline-variant`, and the primary/secondary/tertiary/error `fixed`/`inverse`/`container` families (e.g. `bg-surface-container-lowest`, `text-on-surface-variant`, `text-outline`). The `--accent-*` account palette and `--chart-*` categorical palette are unchanged this step and migrate per-screen later.

### Dark theme (provisional)
LIGHT (Calm Ledger) is the shipped target. `.dark` uses a dark-slate palette: `--background`/`--surface` ← slate-900 `#0F172A`, `--foreground` ← slate-50 `#F8FAFC`, `--card` ← slate-800 `#1E293B`, `--primary` ← slate-300 `#CBD5E1` with a dark `--primary-foreground`, surfaces stepped lighter than the background, and `--income` (`#34D399`) / `--expense` (`#F87171`) lightened for dark. `--input` uses slate-400 `#94A3B8` so form controls remain distinguishable against dark surfaces. The theme toggle and contrast on the checked app screens have been verified; unvisited states still need screen-specific review.

## Typography, spacing, radius
- **Font:** Inter via `next/font/google` (weights 400/500/600/700), self-hosted, exposed as `--font-sans` and wired to Tailwind `font-sans` / the base body. Geist is removed. No CDN link, no npm dependency added.
- **Type scale** (`tailwind.config.ts` `fontSize`, Inter): `text-label-xs`, `text-label-md`, `text-body-sm/md/lg`, `text-currency-body`, `text-title-md`, `text-headline-sm/lg`, `text-currency-display`, `text-display-lg-mobile`, `text-display-lg`. The balance uses the currency/display sizes; metadata uses the label/body sizes. Tabular numerals and right-aligned amounts support scanning.
- **Spacing:** additive named keys `space`-style (`2xs` 0.125rem … `3xl` 3rem, plus `margin`/`gutter` 1rem) merged with Tailwind's default numeric scale, so existing `p-4`/`gap-6` keep working.
- **Radius:** explicit Stitch scale — DEFAULT/`sm` 0.25rem, `md` 0.375rem, `lg` 0.5rem, `xl` 0.75rem, `2xl` 1rem, `full` 9999px.

## Icons
Material Symbols Outlined is loaded via a Google Fonts stylesheet `<link>` in `app/layout.tsx` (a runtime CDN stylesheet, NOT an npm dependency). The reusable `components/ui/icon.tsx` renders a glyph by name: `<Icon name="account_balance_wallet" />` with `size`, `fill`, `weight`, `className`, and an optional `aria-label` (decorative/`aria-hidden` by default, matching the lucide convention). `lucide-react` stays installed; both icon systems coexist during the per-screen migration, after which screens move to Material Symbols.

## Shell
- **Global app chrome** (`components/layout/app-frame.tsx`): the fixed `bg-surface/80` header with the existing Budgetku ledger mark and Pengaturan link appears only on Beranda, leaving other app pages more room for their content. The header has no bottom rule to keep the surface quiet. The five-slot bottom nav appears only on the primary pages `/dashboard`, `/transactions`, `/budget`, and `/accounts`. Forms, detail pages, reports, and settings keep the page title row and its back link without the bottom nav.
- **Bottom nav** (`components/layout/bottom-nav.tsx`): `bg-surface/90 backdrop-blur-xl`, safe-area padding, Material Symbols icons, active `text-primary` + `font-semibold` / inactive `text-on-surface-variant`, 44px tap targets. Five slots with a raised center action: **Beranda** (`/dashboard`), **Transaksi** (`/transactions`), **Catat** (center, raised circular filled-navy FAB linking to `/transactions/new` with a white `add` glyph and a small "Catat" label), **Anggaran** (`/budget`), **Rekening** (`/accounts`). Laporan is managed from Pengaturan, not the dashboard or bottom navigation.
- **Per-screen `AppHeader`** maps the title to `text-headline-lg` and subtitle to `text-body-sm text-on-surface-variant`; `titleAction` places a back control immediately to the left of its title, while `action` remains available for page actions. Back links follow the page hierarchy: Laporan to Pengaturan, Pengaturan to Beranda, and child pages to their owning list. `PageContainer` keeps bottom padding for the fixed nav where it is shown.
- **shadcn primitives** (button/card/input) inherit the new tokens through semantic classes with no API changes.

## Copy and money
Language: natural, concise Indonesian. Labels include Saldo, Rekening, Transaksi terakhir, Pemasukan, Pengeluaran. Actions name their result (Tambah transaksi, Simpan perubahan) only where the feature exists. No generic marketing subtitle, decorative emoji, invented insight, customer count, testimonial, or security promise. Currency: IDR/id-ID, e.g. `Rp12.345.670`; calculation and storage semantics are preserved. Sample amounts are clearly identified as demo data.

## Honesty and anti-slop rules (retained)
- Meaning is never color-only: `AmountText` pairs income/expense color with a sign/text.
- Real data or honest empty/loading/error states; no fabricated insights.
- Functional controls only; no decorative sparkle/status-dot/arrow.
- Motion stays at feedback/transition level with reduced-motion support.
- Softness must not drop text contrast below AA (4.5:1 normal, 3:1 large).

## Purpose notes
- Large balance type: answers the user's primary question immediately.
- Muted account accents: identify accounts without competing with the balance.
- Bordered account surfaces: keep the total, grouped subtotals, and account rows distinct without making every surface appear elevated.
- Bordered recurring schedule surfaces: separate the monthly estimate, schedule, and controls without implying elevation.
- Explicit active/paused labels: keep schedule status understandable without relying on color or opacity.
- Bordered Gmail panels: group connection actions and message history without adding elevation to already information-dense settings.
- Shrinkable chart wrappers: let Recharts use the available phone width instead of expanding to an SVG's intrinsic width.
- Higher-contrast input borders: make form-control edges visible against both the light and dark surfaces.
- 44px control targets: make frequent mobile actions easier to tap without changing their behavior.
- Ledger rows: help compare merchant, date, and amount quickly.
- Stable tokens + Inter: give new screens the same identity as the current app.
