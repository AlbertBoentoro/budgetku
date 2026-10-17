# Budgetku design direction

## Source and status
The active direction is the **Stitch design system** (step 1 of a 12-screen redesign). It supersedes the prior minimal black/white/neutral direction that used Geist and lucide-only icons. The anti-slop honesty principles are retained: meaning is never carried by color alone, controls exist only where the feature exists, and sample data is labeled as demo. Indonesian copy and IDR `Rp` presentation are unchanged.

Status: the **foundation** (tokens, Inter font, Material Symbols icon infrastructure, globals base layer, and the global shell — fixed header, bottom nav, page container) is implemented. Individual feature screens are NOT yet converted; they still render with the previous classes and lucide icons and migrate in later steps. The Stitch mockups are light-only; the dark theme is a documented derived approximation (see below).

## Identity and audience
Budgetku helps Indonesian users understand everyday personal finances. Character: calm, precise, approachable. The Stitch visual language is Material-style: light-blue tinted surfaces, a prominent Rupiah balance, restrained accents, and readable transaction rows.

## Token system
Tokens live in `app/globals.css` as `H S% L%` triplets and are consumed via `hsl(var(--x))` in `tailwind.config.ts`, the globals `<select>` base rule, and chart `fill="hsl(var(--income))"`. Each triplet is converted from an authoritative Stitch hex, noted inline in `globals.css`. This keeps one consistent approach (HSL triplets) and avoids churn to chart/base-layer consumers.

### Stitch → project semantic mapping (light)
- `--background` / `--surface` ← surface `#f8f9ff`
- `--foreground` / `--on-surface` ← on-surface `#0b1c30`
- `--card` / `--popover` ← surface-container-lowest `#ffffff`
- `--primary` ← `#000000`; `--primary-foreground` / `--on-primary` ← `#ffffff`
- `--secondary` ← `#006c4a` (also drives `--income`); `--secondary-foreground` ← `#ffffff`
- `--muted` ← surface-container-low `#eff4ff`; `--muted-foreground` / `--on-surface-variant` ← `#45464d`
- `--accent` ← surface-container `#e5eeff`; `--accent-foreground` ← on-surface `#0b1c30`
- `--destructive` / `--error` ← `#ba1a1a` (also drives `--expense`); `--destructive-foreground` ← `#ffffff`
- `--border` / `--input` / `--outline-variant` ← outline-variant `#c6c6cd`
- `--ring` ← primary `#000000`
- `--income` ← `#006c4a`, `--expense` ← `#ba1a1a` (AmountText tone logic; always paired with sign/text)

New additive Stitch role tokens are available as Tailwind classes verbatim: the `surface-container-*` scale, `surface-bright/dim/variant/tint`, `on-surface` / `on-surface-variant`, `outline` / `outline-variant`, and the primary/secondary/tertiary/error `fixed`/`inverse`/`container` families (e.g. `bg-surface-container-lowest`, `text-on-surface-variant`, `text-outline`). The `--accent-*` account palette is unchanged this step and migrates per-screen later.

### Dark theme (derived approximation)
The mockups are light-only. `.dark` is derived from the Stitch inverse tokens and tuned for AA: `--background`/`--surface` ← inverse-surface `#213145`, `--foreground` ← inverse-on-surface `#eaf1ff`, `--primary` ← inverse-primary `#bec6e0` with a dark `--primary-foreground`, surfaces stepped lighter than the background, and `--income` (`#68dba9`) / `--expense` (`#ffb4ab`) lightened to hold AA on dark. It is marked as a derived approximation in `globals.css`, not an author-supplied Stitch dark palette.

## Typography, spacing, radius
- **Font:** Inter via `next/font/google` (weights 400/500/600/700), self-hosted, exposed as `--font-sans` and wired to Tailwind `font-sans` / the base body. Geist is removed. No CDN link, no npm dependency added.
- **Type scale** (`tailwind.config.ts` `fontSize`, Inter): `text-label-xs`, `text-label-md`, `text-body-sm/md/lg`, `text-currency-body`, `text-title-md`, `text-headline-sm/lg`, `text-currency-display`, `text-display-lg-mobile`, `text-display-lg`. The balance uses the currency/display sizes; metadata uses the label/body sizes. Tabular numerals and right-aligned amounts support scanning.
- **Spacing:** additive named keys `space`-style (`2xs` 0.125rem … `3xl` 3rem, plus `margin`/`gutter` 1rem) merged with Tailwind's default numeric scale, so existing `p-4`/`gap-6` keep working.
- **Radius:** explicit Stitch scale — DEFAULT/`sm` 0.25rem, `md` 0.375rem, `lg` 0.5rem, `xl` 0.75rem, `2xl` 1rem, `full` 9999px.

## Icons
Material Symbols Outlined is loaded via a Google Fonts stylesheet `<link>` in `app/layout.tsx` (a runtime CDN stylesheet, NOT an npm dependency). The reusable `components/ui/icon.tsx` renders a glyph by name: `<Icon name="account_balance_wallet" />` with `size`, `fill`, `weight`, `className`, and an optional `aria-label` (decorative/`aria-hidden` by default, matching the lucide convention). `lucide-react` stays installed; both icon systems coexist during the per-screen migration, after which screens move to Material Symbols.

## Shell
- **Fixed top header** (`app/(app)/layout.tsx`): `bg-surface/80 backdrop-blur-xl`, holds the "Budgetku" wordmark and a settings icon-button linking to `/settings`. This is the new entry point for Pengaturan after it left the bottom nav. `<main>` top padding clears the fixed bar; `AuthGuard` and `BottomNav` stay inside `<Suspense>` for PPR.
- **Bottom nav** (`components/layout/bottom-nav.tsx`): `bg-surface/90 backdrop-blur-xl`, safe-area padding, Material Symbols icons, active `text-primary` / inactive `text-on-surface-variant`. Mockup order: **Beranda, Transaksi, Anggaran, Laporan, Rekening** (all routes resolve; `/reports` already exists). Pengaturan is intentionally not in the nav.
- **Per-screen `AppHeader`** maps the title to `text-headline-lg` and subtitle to `text-body-sm text-on-surface-variant`; the `action` slot API is unchanged. `PageContainer` keeps the bottom padding that clears the fixed nav.
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
- Ledger rows: help compare merchant, date, and amount quickly.
- Stable tokens + Inter: give new screens the same identity as the current app.
