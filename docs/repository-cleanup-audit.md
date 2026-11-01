# Audit cleanup repositori Budgetku

Tanggal: 1 November 2026 (WIB). Lingkup: dokumentasi dan inventaris cleanup, tanpa penghapusan berkas atau perubahan perilaku aplikasi.

## Basis Git dan perlindungan pekerjaan

- Checkout awal: `/workspace/budgetku`, branch `work`, HEAD `bc92dd0f7a6c5ff3afc4ed359fdcf8bbdf7acba3`; status awal bersih, termasuk pemeriksaan untracked.
- `git fetch origin main` dan `git ls-remote --heads origin main perf/reports-parallel` memastikan `main` berada di `bc92dd0` dan branch Reports di remote berada di `f1d91a915d51858f70a495984710f396af156d77`.
- Worktree terpisah: `/workspace/budgetku-cleanup`, branch `chore/repository-cleanup`, dibuat dari `origin/main` pada `bc92dd0`. Tidak ada patch Reports atau Budget yang diterapkan. Perubahan Budget dan tes yang disebut pengguna tidak tersedia pada checkout cloud ini; audit tidak menyimpulkan bahwa pekerjaan tersebut hilang atau aman di mesin lain.
- Selama audit tidak ada reset, stash, clean, penghapusan berkas, staging, commit, push, merge, deployment, maupun perubahan konfigurasi environment. Fetch hanya memperbarui metadata/ref lokal. Setelah audit, pengguna menyetujui commit dokumentasi melalui instruksi "gas commit"; persetujuan ini tidak mencakup penghapusan, push, merge, atau deployment.
- Dependensi yang sudah terpasang digunakan melalui symlink lokal `node_modules` ke checkout awal. Symlink diabaikan Git; hasil `.next/`, `next-env.d.ts`, dan `tsconfig.tsbuildinfo` berada di worktree cleanup dan diabaikan Git. Tidak ada instalasi atau perubahan manifest/lockfile.

## Metode dan batas bukti

Inventaris mencakup 217 berkas terlacak pada basis main, termasuk dotfiles: source aplikasi, komponen, library, aset publik, konfigurasi, dokumen, SQL, skill, serta tiga JSON task. Sebanyak 163 berkas JavaScript/TypeScript diperiksa melalui AST TypeScript. Root keterjangkauan mencakup seluruh modul `app/` (termasuk entry point berbasis konvensi), proxy, dan konfigurasi. Resolver memakai opsi `tsconfig.json`, sehingga alias `@/`, impor relatif, serta re-export diperhitungkan.

Analisis mencari `import()`, `require()`, glob loader, dan `require.context`; tidak ada call semacam itu dalam source terlacak pada basis ini. Pencarian nama simbol dan jalur di source, konfigurasi, serta dokumen melengkapi graf. Tidak ditemukan registry pemuatan komponen berdasarkan nama berkas. Enam kandidat di bawah memiliki nol incoming import dan tidak terjangkau dari root aplikasi. Komponen dipilih berdasarkan graf dan pemeriksaan pemakaian nyata, bukan nama berkas saja. Hal ini tidak membuktikan kebutuhan branch lain atau rencana pengembangan; konfirmasi pemilik tetap diperlukan sebelum penghapusan.

Aset diperiksa melalui header/dimensi, hash byte, referensi kode, konvensi metadata Next.js, dan inspeksi visual gambar sosial, ikon PWA, serta favicon. Semua duplikat byte dalam berkas terlacak dicari; hanya dua pasangan gambar yang identik. Core anti-slop juga dibandingkan setelah mengabaikan frontmatter kemasan skill. Isi secret, file kredensial, dan database live tidak dibaca. Ini bukan audit penetrasi, verifikasi RLS live, atau pemeriksaan seluruh riwayat Git untuk kebocoran secret.

## Inventaris kandidat

KEEP berarti dipertahankan; UPDATE berarti perlu koreksi; ARCHIVE berarti pindahkan ke lokasi sejarah dalam perubahan berikutnya yang disetujui; REMOVE berarti usulan penghapusan, belum dilaksanakan. Pemindahan atau untracking juga menunggu persetujuan karena menghilangkan path lama.

### Dokumentasi dan riwayat

| Berkas/kandidat | Keputusan | Bukti dan dampak | Tindakan pada diff ini |
| --- | --- | --- | --- |
| `README.md` | UPDATE | Memuat judul/link demo starter, clone template, dan promosi Supabase; tidak menjelaskan aplikasi Budgetku. Source `app/(app)/`, `lib/`, skrip npm, dan `.env.example` menjadi dasar fitur/setup baru. | Ditulis ulang dalam bahasa Indonesia; tanpa klaim pengujian fitur eksternal. |
| `public/icons/README.md` | UPDATE | Mengatakan PNG belum ada, padahal empat PNG dilacak. `manifest.ts`, metadata layout, AppFrame, dan service worker merujuk aset tersebut. | Memperbaiki status, ukuran, referensi, dan catatan safe area maskable. |
| `docs/ANTI-SLOP-WORKFLOW.md` | UPDATE | Menyebut USD/en-US dan HTML en sebagai kondisi saat ini. `amount-text.tsx` kini IDR/id-ID; layout kini `lang="id"`. | Memisahkan catatan pemasangan dari kondisi sekarang, merujuk Calm Ledger, dan menghapus asumsi satu jalur Windows untuk workspace Kiro. |
| `docs/CHATGPT-PROJECT-INSTRUCTIONS.md` | UPDATE | Arah editorial lama kurang sesuai dengan Calm Ledger pada DESIGN. Ini adapter instruksi manual, bukan source UI. | Memperjelas arah desain yang aktif; aturan dan scope tetap ada. |
| `docs/settings-integrations.md` | UPDATE | Berisi hasil sesi lama, status domain/account/production, dan peringatan deploy yang tidak dapat dianggap pemeriksaan terkini. Kode backup/cron masih menggunakan integrasi yang dijelaskan. | Menandai bagian verifikasi sebagai historis, tanpa menghapus bukti lama atau mengubah SQL. |
| `.agents/tasks/task-budgetku-ui-foundation/features/FEAT-001.json` | ARCHIVE | Status completed; instruksi Geist, token lama, dan PNG belum tersedia sudah usang. Saat ini tetap tracked meskipun `.gitignore` mengabaikan `.agents/tasks/`. | Tetap utuh; usulkan pindah ke `docs/archive/ui-foundation/FEAT-001.json`. |
| `.agents/tasks/task-budgetku-ui-foundation/features/FEAT-002.json` | ARCHIVE | Status completed; mencatat penghapusan starter terdahulu. File demo, tutorial, dan `/protected` yang disebut tidak ada lagi pada daftar tracked. | Tetap utuh; usulkan pindah ke `docs/archive/ui-foundation/FEAT-002.json`. |
| `.agents/tasks/task-budgetku-ui-foundation/features/FEAT-003.json` | ARCHIVE | Status completed; struktur dashboard demo, USD, Geist, dan shell lama bukan kontrak implementasi sekarang. Penting sebagai sejarah perubahan. | Tetap utuh; usulkan pindah ke `docs/archive/ui-foundation/FEAT-003.json`. |
| `anti-slop/audit-002-2026-10-07.md` | KEEP | Audit bertanggal menyimpan temuan dan konteks pemeriksaan. Bukan panduan setup aktif. | Tidak dipindahkan/dihapus. |
| `anti-slop/delivery-2026-10-29-transactions-month-chip.md` | KEEP | Riwayat verifikasi bertahap transaksi; sejarah Git juga mencatat pembaruan hasil deploy. | Tidak menghapus bukti atau menyamakan hasil lama dengan audit baru. |
| `anti-slop/delivery-2026-11-01-material-symbols-subset.md` | KEEP | Berkaitan langsung dengan commit main `bc92dd0` dan subset ikon aktif. | Tetap dilacak. |

Tiga task completed tidak perlu tetap menjadi task aktif yang dilacak di `.agents/tasks/`. Rekomendasi adalah mempertahankan isinya sebagai arsip terlacak, dengan catatan bahwa instruksinya sudah selesai dan tidak boleh diterapkan ulang. Tidak disarankan sekadar `git rm --cached` karena itu memutus akses riwayat lokal bagi clone baru dan tetap merupakan penghapusan dari repositori. Pencarian identifier task tidak menemukan konsumen untuk jalur task tersebut di luar ketiga JSON; komentar FEAT-002/003 pada library Gmail adalah identifier generik dan bukan bukti penggunaan task UI foundation. Agent skills dan aturan aktif harus tetap dipertahankan.

### Komponen tidak terjangkau

| Berkas | Keputusan | Bukti spesifik dan dampak |
| --- | --- | --- |
| `components/dashboard/quick-actions.tsx` | REMOVE, menunggu persetujuan | `QuickActions` hanya didefinisikan di berkas ini; nol incoming import, tidak ada ekspor barrel/dynamic loader. Dashboard menyusun kartu dan transaksi secara langsung. Link `/goals`, `/settings/gmail`, `/reports`, `/recurring` di dalam komponen bukan referensi balik ke komponen. Jangan menghapus route tujuannya. |
| `components/finance/account-card.tsx` | REMOVE, menunggu persetujuan | `AccountCard` tanpa incoming import. Dashboard memakai `DashboardAccountCard`, daftar rekening memakai `AccountManager`/`AccountRow`; ini komponen berbeda. Pertahankan tipe/warna rekening dan `AmountText`. |
| `components/finance/balance-card.tsx` | REMOVE, menunggu persetujuan | `BalanceCard` tanpa incoming import. Dashboard mengimpor `NetBalanceCard`. Komentar yang menyebut nama BalanceCard bukan pemakaian runtime. |
| `components/shared/section-header.tsx` | REMOVE, menunggu persetujuan | `SectionHeader` tanpa incoming import; dashboard memiliki fungsi lokal `SectionHeaderRow`. Jangan menghapus fungsi lokal tersebut. |
| `components/theme-switcher.tsx` | REMOVE, menunggu persetujuan | `ThemeSwitcher` tanpa incoming import; pengaturan memakai `components/settings/theme-setting-row.tsx`, sementara layout memakai ThemeProvider. Jangan menghapus `next-themes`, provider, atau kontrol tema aktif. |
| `components/ui/badge.tsx` | REMOVE, menunggu persetujuan | Tidak ada konsumen `Badge`, `badgeVariants`, atau path `ui/badge`. Primitive lokal ini bukan entry point framework. Pertahankan `class-variance-authority` yang juga dipakai Button. |

Tidak ada library `lib/` lain yang tidak terjangkau pada graf. Tidak ada klaim bahwa semua ekspor dalam modul aktif digunakan; pembersihan per-ekspor/dependensi bukan bagian diff dokumentasi ini. Jika enam penghapusan disetujui, ulangi lint, TypeScript, build, serta smoke test setelah penghapusan. Jangan menghapus dependency sebagai efek samping tanpa audit terpisah.

### Branding, metadata, dan duplikasi

| Aset/kandidat | Keputusan | Bukti dan dampak |
| --- | --- | --- |
| `app/opengraph-image.png` | UPDATE, belum diterapkan | PNG 1200×600 berisi Next.js Starter Kit dan promosi Supabase. Next.js memuatnya sebagai metadata berbasis konvensi; build mencantumkan route, request lokal memberi HTTP 200 dan byte yang sama. Tidak aman menyebutnya unused hanya karena tanpa impor. |
| `app/twitter-image.png` | UPDATE, belum diterapkan | Identik byte dengan gambar Open Graph, juga route metadata Next.js. Duplikasi ini melayani dua konvensi berbeda; jangan menghapus salah satunya tanpa rencana metadata pengganti. |
| `app/favicon.ico` | UPDATE, belum diterapkan | Inspeksi frame 256 menunjukkan segitiga Vercel; ICO memiliki ukuran 16, 32, 48, dan 256. Next.js memakai nama khusus ini secara otomatis. Ganti dengan varian logo Budgetku dalam perubahan aset yang ditinjau. |
| `public/icons/budgetku-ledger.svg` | KEEP | Logo Rp navy/emerald; AppFrame memakai URL `/icons/budgetku-ledger.svg`. Sumber artwork juga disebut dalam dokumentasi ikon. |
| `public/icons/icon-192.png` | KEEP | 192×192 dengan logo Rp; digunakan manifest serta ikon/badge service worker. |
| `public/icons/icon-512.png` | KEEP | 512×512 dengan logo Rp; manifest `purpose: any`. |
| `public/icons/icon-512-maskable.png` | UPDATE, belum diterapkan | 512×512, identik byte dengan icon-512 biasa. Nama/purpose berbeda tetap diperlukan. Sudut tanda buku melampaui lingkaran aman radius 204,8 px dari pusat; perlu varian dengan skala aman, bukan menghapus file duplikat. |
| `public/icons/apple-touch-icon.png` | KEEP | 180×180 dengan logo Rp; metadata `icons.apple` menunjuknya secara eksplisit. Tidak mengandalkan auto-discovery di public. |
| `app/manifest.ts` dan `public/service-worker.js` | KEEP | Manifest memakai nama/warna Budgetku; service worker menangani push dan notification click. Tidak ada cache offline data finansial. Menghapusnya merusak PWA/notifikasi. |
| `antislop.md` dan `.agents/skills/antislop/SKILL.md` | KEEP | Badan core sama persis; skill menambah frontmatter kemasan. Keduanya jalur distribusi yang tercatat dalam AGENTS dan metadata upstream. Bukan duplikasi tidak sengaja; jangan edit snapshot secara sepihak. |

Penggantian gambar sosial/favicon bukan koreksi dokumentasi: itu mengubah aset yang dikirim aplikasi. Audit ini melaporkan dan mempertahankannya agar semua perubahan terapan tetap dokumentasi saja. Branding repo belum sepenuhnya selesai sebelum penggantian aset tersebut ditinjau dan diuji. Tidak ada gambar baru yang dibuat atau branding yang diklaim sudah diperbaiki pada runtime.

### Berkas aktif dan artefak pengembangan

| Kelompok/kandidat | Keputusan | Referensi/pengaruh |
| --- | --- | --- |
| `AGENTS.md`, `DESIGN.md`, `.kiro/steering/*.md`, `.agents/skills/**` | KEEP | Aturan aktif proyek, routing skill, dan arah desain. Jangan hapus seluruh `.agents`. |
| `docs/anti-slop/LICENSE`, `docs/anti-slop/UPSTREAM.json`, `.agents/skills/antislop/VERSION` | KEEP | Lisensi dan provenance snapshot. Harus tetap tersedia meskipun file panduan besar. |
| `docs/sql/*.sql` (9 berkas) | KEEP | Perubahan skema/grant/RLS/hardening serta penghapusan passkey historis; dirujuk panduan integrasi. Bukan dump schema awal lengkap. SQL removal passkey bukan komponen aplikasi yang unused; tetap penting untuk migrasi. Tidak dieksekusi. |
| `lib/supabase/database.types.ts` | KEEP | Tipe database dipakai modul akses data dan formulir. Walau dihasilkan dari schema, perlu tersedia saat typecheck; bukan cache build. |
| `app/**`, `lib/**`, komponen lain di luar enam kandidat | KEEP | Entry point route/metadata/actions dan graf modul aplikasi aktif; mencakup callback login, error page, autentikasi, parser, perhitungan, dan UI. Tidak menghapus loading state, route, atau data logic. |
| `components/ui/dropdown-menu.tsx`, `components/ui/checkbox.tsx`, Lucide dan Material Symbols | KEEP | Primitive/modul terjangkau dari aplikasi. Kedua sistem ikon sengaja hidup bersama selama migrasi desain. Menghapus ThemeSwitcher tidak berarti dropdown atau dependency ikonnya menjadi unused. |
| `components.json`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json` | KEEP | Konfigurasi UI generator dan toolchain. Keberadaan shadcn atau Tailwind bukan bukti sisa starter yang dapat dibuang. |
| `next.config.ts`, `proxy.ts`, `vercel.json`, `.env.example` | KEEP | Cache/PPR, keamanan header, sesi, jadwal dan variabel integrasi. Tidak berubah dalam cleanup. |
| `eslint.config.mjs`, `eslint-rules/connection-before-supabase.mjs` | KEEP | Lint aktif dan aturan request-time Supabase. ESLint sudah mengabaikan `.next`; temuan lint lama dalam task JSON bukan kondisi saat ini. |
| `package.json`, `package-lock.json` | KEEP | Skrip proyek dan dependensi terkunci. Tidak menambah runner, mengganti paket, atau menghapus dependency. |
| `.gitignore`, `.vscode/settings.json`, `.vscode/mcp.json` | KEEP | Aturan artefak dan integrasi editor. Konfigurasi editor/MCP bukan komponen runtime. Tidak mencetak nilai konfigurasi yang berpotensi sensitif atau mengubah integrasi developer. |
| `node_modules/`, `.next/`, `next-env.d.ts`, `tsconfig.tsbuildinfo` | KEEP secara lokal, tetap untracked/ignored | Dependencies, hasil build, dan tipe hasil generator diperlukan untuk workflow. Tidak ada file semacam ini yang dilacak pada basis audit. Tidak perlu penghapusan dari Git. |
| Starter `components/tutorial/`, `hero`, `deploy-button`, logo starter, `app/protected/` | KEEP kondisi tidak ada | Sudah tidak ada dalam daftar tracked. Jangan menjalankan ulang penghapusan dari instruksi task lama. |

Tidak ada direktori CI `.github/workflows` atau test runner terlacak pada main yang diperiksa. Ini dicatat sebagai keterbatasan pemeliharaan; tidak dibuat konfigurasi baru di luar scope. Repositori juga tidak mempunyai pin Node atau bootstrap schema lengkap, sehingga README menjelaskannya tanpa mengarang kemampuan instalasi database dari nol.

## Pemeriksaan dan hasil

Semua perintah aplikasi dijalankan di `/workspace/budgetku-cleanup`, Node 24.19.0 / npm 11.9.0, dengan dependency yang telah tersedia. Tidak ada dependency baru.

| Pemeriksaan | Hasil saat audit |
| --- | --- |
| `npm run lint` | Exit 0; tidak ada error/warning yang dicetak. |
| `npm test` | Exit 1: skrip `test` tidak ada. npm juga menyebut log tidak dapat ditulis ke direktori home karena sandbox. Tidak ada tes yang dijalankan; ini kekurangan baseline, bukan suite lulus atau regresi cleanup. |
| `npm run build` | Exit 0; compile, pemeriksaan tipe Next.js, dan 39/39 halaman statis selesai. Empat worker. Tidak ada warning compiler/config/font yang dicetak. Route metadata, budget, dan reports tetap terdaftar. |
| `./node_modules/.bin/tsc --noEmit` | Exit 0 setelah generasi tipe Next.js. |
| `git diff --check` | Exit 0. |
| `npm start -- --hostname 127.0.0.1 --port 3100` | Server production lokal siap; bukan deploy. |
| GET `/auth/login` lokal | HTTP 200; HTML memuat Budgetku dan kontrol Google. Tidak menyelesaikan OAuth/login. |
| GET `/manifest.webmanifest` lokal | HTTP 200; nama Budgetku, start URL `/dashboard`, ketiga ikon sesuai manifest. |
| GET `/opengraph-image.png` lokal | HTTP 200; byte identik dengan aset tracked. Membuktikan aset starter masih digunakan. |

Belum diuji: login Google end-to-end, mutasi transaksi, isolasi data/RLS live, Gmail, backup, Cron, pengiriman push, semua state UI, dan responsive/browser visual. Tidak menyatakan keamanan data atau kelulusan UI berdasarkan lint/build. Tidak ditemukan regresi pada pemeriksaan yang dijalankan; tidak ada perubahan source/runtime untuk dibandingkan perilakunya. Tes Reports/Budget dari branch lain sengaja tidak diambil.

## Ringkasan diff per berkas

| Berkas | Perubahan terapan |
| --- | --- |
| `README.md` | Mengganti seluruh promosi/link starter dengan penjelasan Budgetku, fitur berbukti source, stack, struktur, setup, nama variabel, skrip, batas testing, dan catatan deployment. |
| `public/icons/README.md` | Memperbaiki inventaris aktual, referensi eksplisit, safe area maskable, dan status branding sosial/favicon. |
| `docs/ANTI-SLOP-WORKFLOW.md` | Memperbaiki klaim locale/UI lama dan jalur workspace; mempertahankan sejarah, provenance, dan aturan. |
| `docs/CHATGPT-PROJECT-INSTRUCTIONS.md` | Menyelaraskan uraian arah desain dengan Calm Ledger. |
| `docs/settings-integrations.md` | Menandai hasil verifikasi lama sebagai historis agar tidak menyesatkan tentang production saat ini. |
| `docs/repository-cleanup-audit.md` | Laporan baru ini: basis Git, bukti, inventaris, risiko, hasil perintah, dan usulan tinjauan. |

Pada penyerahan awal, seluruh perubahan belum distage dan belum di-commit. Pengguna kemudian menyetujui commit dokumentasi dan laporan ini. Tidak ada file yang dihapus. Setelah commit, tinjau keenam berkas dengan `git -C /workspace/budgetku-cleanup show --stat HEAD` dan `git -C /workspace/budgetku-cleanup show HEAD`.

## Usulan untuk persetujuan berikutnya

1. Hapus hanya enam komponen pada tabel REMOVE setelah pemilik menyetujui keenam path tersebut. Tidak termasuk dependency, fitur, atau route tujuannya.
2. Pindahkan tiga JSON completed ke `docs/archive/ui-foundation/`, mempertahankan isi dan status sejarah. Tidak menghapus skill/instruksi aktif atau laporan delivery.
3. Siapkan pengganti aset Budgetku untuk dua gambar sosial, favicon, dan ikon maskable. Pertahankan nama/URL metadata atau rencanakan metadata pengganti secara eksplisit. Ini belum masuk diff dokumentasi.

Pekerjaan ini berhenti pada diff dokumentasi dan daftar konkret untuk ditinjau. Persetujuan cleanup tidak mencakup commit, push, merge, deploy, atau perubahan environment.
