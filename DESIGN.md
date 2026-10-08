# Budgetku design direction

## Source and status
Direction adapted from the user's linked conversation: a minimal, premium, editorial, mobile-first personal finance app; softer account colors, more spacious balance typography, Indonesian copy, and IDR. The Pinterest image is unavailable in this session, so this document does not claim to reproduce it. Specific implementation values below are working interpretations, not newly approved brand assets.

## Identity and audience
Budgetku helps Indonesian users understand everyday personal finances. Character: calm, precise, approachable. The visual signature is a prominent Rupiah balance, restrained account accents, and a readable transaction ledger. Premium means deliberate hierarchy and spacing, not decorative luxury cues.

## Composition and rhythm
Dial: ENERGY 1 / RHYTHM 2 / MOTION 1.
Dashboard focal point: total balance. The balance is a spacious typographic section with minimal framing. Accounts form a supporting group; transactions use compact rows with quieter dates and merchant metadata. Sections vary because these information types differ, not to fill a dashboard template. Keep the existing mobile content width on desktop unless the brief changes.

## Palette and surfaces
Existing CSS variables in `app/globals.css` and mappings in `tailwind.config.ts` are the implementation source. Neutral surfaces dominate; one restrained action accent anchors the screen. Account differentiation uses muted existing colors in small supporting areas, not a saturated rainbow of full cards. Income/expense colors communicate meaning and always have text/signs alongside them. Target 2-3 active core colors plus one accent, with semantic states used only where necessary. Softness must not reduce text contrast below AA (4.5:1 normal text, 3:1 large text).

## Typography and spacing
Existing Geist is retained for readable compact labels and consistent numeric forms, avoiding unnecessary font downloads or migrations. Balance type is clearly larger than section headings; metadata is quieter without becoming illegible. Tabular numerals and right-aligned amounts support scanning. Sentence case replaces widely tracked uppercase. Use the current spacing/radius system with larger gaps between sections and tighter gaps within related content. Most surfaces are flat; borders and shadows identify grouping or elevation only where useful.

## Copy and money
Language: natural, concise Indonesian. Labels include Saldo, Rekening, Transaksi terakhir, Pemasukan, Pengeluaran. Actions name their result, such as Tambah transaksi or Simpan perubahan, only where the feature exists. No generic marketing subtitle, decorative emoji, invented financial insight, customer count, testimonial, or security promise. Currency presentation: IDR/id-ID, such as Rp12.345.670; preserve existing calculation and storage semantics. Sample amounts must be clearly identified as demo data.

## Icons and motion
Existing Lucide glyphs remain when they explain navigation, accounts, or actions. The label carries meaning; no sparkle, magic, status dot, or arrow merely to decorate. Motion stays at feedback/transition level with reduced-motion support; no floating balance, pulsing badge, or scroll spectacle. Existing shipped themes must remain legible and functional.

## Purpose notes
- Large balance: answers the user's primary question immediately.
- Muted account accents: identify accounts without competing with the balance.
- Ledger rows: help compare merchant, date, and amount quickly.
- Whitespace around balance: separates the primary number from supporting detail.
- Stable typography and tokens: give new screens the same identity as the current app.
