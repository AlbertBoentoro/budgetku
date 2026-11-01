# Budgetku

Budgetku adalah aplikasi pencatatan keuangan pribadi berbahasa Indonesia dengan tampilan nominal Rupiah (IDR). Aplikasi menggunakan Next.js dan Supabase untuk autentikasi, penyimpanan data, dan pengelolaan data keuangan per pengguna.

## Fitur

Fitur berikut tersedia pada kode aplikasi. Integrasi eksternal membutuhkan konfigurasi dan pengujian tersendiri.

- Beranda dengan saldo rekening, ringkasan anggaran, dan transaksi terbaru.
- Pengelolaan rekening, saldo awal, dan arsip rekening.
- Pencatatan pemasukan, pengeluaran, dan transfer; penyaringan transaksi menurut bulan, jenis, rekening, kategori, dan pencarian teks.
- Anggaran bulanan dengan pos anggaran dan perbandingan pengeluaran aktual.
- Target tabungan dengan kontribusi dan riwayat progres.
- Template transaksi rutin, status aktif/nonaktif, dan pembuatan transaksi melalui tindakan pengguna. Keberadaan template tidak berarti transaksi dibuat otomatis oleh Cron.
- Laporan bulanan dengan ringkasan, rincian kategori pengeluaran, dan tren bulanan.
- Impor Gmail melalui OAuth, sinkronisasi manual, parser BCA/Shopee/GoPay, dan peninjauan draft sebelum menjadi transaksi. Parser bersifat best-effort; format email dapat berubah.
- Ekspor transaksi CSV dan data JSON; cadangan cloud manual dan terjadwal, serta unduhan cadangan terbaru. Pemulihan otomatis dari JSON belum tersedia.
- Preferensi tampilan, pilihan tema, dan pengingat Web Push yang memerlukan dukungan browser serta izin pengguna.
- Manifest PWA dan ikon layar utama. Service worker menangani notifikasi; aplikasi belum menyediakan cache offline untuk data keuangan.

Login yang tersedia menggunakan Google melalui Supabase Auth. Jangan menganggap formulir registrasi atau login kata sandi tersedia hanya karena proyek memakai Supabase.

## Teknologi

- Next.js 16.4.3, App Router, React 19, TypeScript, dan Webpack melalui skrip proyek.
- Supabase Auth, PostgreSQL, Storage, `@supabase/ssr`, dan `@supabase/supabase-js`.
- Tailwind CSS 3, komponen Radix UI/shadcn, `next-themes`, Material Symbols, dan Lucide.
- Recharts untuk grafik; Google APIs untuk Gmail; `web-push` untuk notifikasi.
- ESLint 9 dengan aturan lokal `connection-before-supabase`.
- Vercel Analytics dan Speed Insights; konfigurasi deployment dan Cron di `vercel.json`.

Versi terperinci dan resolusi dependensi ada di `package.json` dan `package-lock.json`. Pertahankan lockfile saat memasang dependensi.

## Struktur proyek

```text
app/
  (app)/              Halaman keuangan dan shell dengan pemeriksaan autentikasi
  auth/               Login Google, callback, dan penanganan kegagalan login
  api/                Ekspor, Gmail, cadangan, Web Push, dan Cron
  manifest.ts         Manifest PWA
components/           Komponen fitur, tata letak, grafik, dan UI
lib/                  Akses data, kalkulasi, parser Gmail, dan utilitas
  supabase/           Klien browser/server/admin dan tipe database
public/               Ikon dan service worker notifikasi
docs/                 Panduan integrasi, SQL tambahan, dan laporan audit
eslint-rules/         Aturan lint khusus proyek
.agents/skills/       Panduan agent lokal
.kiro/steering/       Aturan scope dan alur kerja proyek
```

## Menjalankan secara lokal

1. Gunakan Node.js yang memenuhi persyaratan paket terkunci. Lingkungan audit memakai Node.js 24.19.0 dan npm 11.9.0; repositori belum memiliki pin versi Node tersendiri.
2. Clone repositori ini atau gunakan checkout yang sudah tersedia, lalu jalankan dari root proyek:

   ```bash
   npm ci
   ```

3. Buat `.env.local` dengan dua variabel Supabase wajib pada tabel berikut. Gunakan proyek pengembangan yang sesuai. Jangan menimpa `.env.local` yang sudah ada atau menyalin semua placeholder integrasi opsional sebagai nilai aktif.
4. Pastikan skema database yang dibutuhkan aplikasi sudah tersedia. `lib/supabase/database.types.ts` mendeskripsikan tabel/tipe yang dipakai. Berkas `docs/sql/` berisi perubahan tambahan, bukan bootstrap lengkap database baru. Tinjau skema, grant, dan RLS bersama pengelola database; jangan menjalankan semua SQL secara buta pada production.
5. Aktifkan provider Google di Supabase Auth. Simpan OAuth client ID dan client secret untuk login pada pengaturan provider Supabase. Daftarkan callback provider `https://<project-ref>.supabase.co/auth/v1/callback` di Google Cloud, dan izinkan callback aplikasi `http://localhost:3000/auth/callback` pada Redirect URLs Supabase. Sesuaikan origin dan port yang benar.
6. Jalankan `npm run dev`, lalu buka aplikasi melalui port lokal 3000. Root mengarahkan pengguna ke halaman login atau beranda berdasarkan sesi.

Gunakan proxy dan CA tepercaya yang disediakan lingkungan. Build mengunduh Inter dari `fonts.googleapis.com`/`fonts.gstatic.com`; Material Symbols juga membutuhkan kedua domain tersebut saat aplikasi dibuka. Integrasi membutuhkan akses ke hostname Supabase yang dipilih dan layanan eksternalnya. Jangan menonaktifkan verifikasi TLS untuk mengatasi kegagalan jaringan.

## Variabel lingkungan

Nama variabel juga dicatat dalam [`.env.example`](.env.example). Isi nilai melalui `.env.local` yang diabaikan Git atau pengaturan environment deployment. Jangan menyimpan nilai rahasia dalam Git, log, atau percakapan.

| Nama | Kebutuhan | Kegunaan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Wajib | URL proyek Supabase yang dipakai aplikasi. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Wajib | Publishable key atau anon key publik untuk proyek yang sama. Akses data tetap memerlukan RLS yang benar. |
| `SUPABASE_SERVICE_ROLE_KEY` | Cadangan/pengingat terjadwal | Kredensial admin khusus server; jangan gunakan awalan `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Cron | Otorisasi request pekerjaan terjadwal. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push | Kunci publik pendaftaran notifikasi. |
| `VAPID_PRIVATE_KEY` | Web Push | Kunci privat pengiriman notifikasi, khusus server. |
| `VAPID_SUBJECT` | Web Push | Kontak VAPID. |
| `GOOGLE_CLIENT_ID` | Impor Gmail | OAuth client ID untuk integrasi Gmail, terpisah dari konfigurasi provider login Supabase. |
| `GOOGLE_CLIENT_SECRET` | Impor Gmail | OAuth client secret khusus server. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Impor Gmail | Callback integrasi; lokal: `http://localhost:3000/api/gmail/callback`. |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Impor Gmail | Kunci 32 byte dalam base64 untuk enkripsi token Gmail di server. |
| `VERCEL_URL` | Disediakan platform bila tersedia | Dasar URL metadata; fallback kode adalah origin lokal port 3000. |

Nilai `NEXT_PUBLIC_*` dibundel ke browser. Service role, client secret, kunci enkripsi, dan private key tidak boleh ditempatkan di variabel publik. Konfigurasi rinci cadangan, Web Push, dan SQL tambahan tersedia di [panduan integrasi](docs/settings-integrations.md).

## Perintah pengembangan

| Perintah | Fungsi |
| --- | --- |
| `npm ci` | Memasang dependensi sesuai lockfile. |
| `npm run dev` | Menjalankan server pengembangan dengan Webpack. |
| `npm run lint` | Memeriksa source dengan ESLint tanpa mengubah file. |
| `./node_modules/.bin/tsc --noEmit` | Memeriksa tipe; jalankan setelah Next.js menghasilkan tipe route bila checkout masih baru. |
| `npm run build` | Membuat build production dan menjalankan pemeriksaan Next.js. |
| `npm start` | Menjalankan hasil build production. |

## Pengujian

Pada basis `main` yang diaudit (`bc92dd0`), tidak ada skrip `test`, konfigurasi test runner, atau berkas suite pengujian yang dilacak. `npm test` belum dapat dipakai; lint dan build bukan pengganti pengujian perilaku aplikasi. Tes pada branch fitur lain tidak termasuk pernyataan ini.

Sebelum merilis perubahan, jalankan lint, pemeriksaan TypeScript, dan build. Pada environment pengujian dengan akun dan skema yang sesuai, periksa login/callback/logout, isolasi data antarpengguna, transaksi dan transfer, perhitungan saldo/anggaran, serta fitur yang berubah. Uji Gmail, cadangan, Cron, dan Web Push hanya dengan akses yang diizinkan; tindakan tersebut dapat membaca layanan eksternal atau menulis data.

Untuk perubahan UI, ikuti `AGENTS.md` dan `DESIGN.md`, termasuk pemeriksaan tema, keyboard, nominal IDR panjang, serta keadaan kosong/loading/error. Hasil pemeriksaan cleanup ini ada dalam [laporan audit repositori](docs/repository-cleanup-audit.md).

## Deployment

Proyek memiliki konfigurasi Vercel dengan region `syd1`. Cron memanggil `/api/cron/settings` setiap hari pukul 13.00 UTC (20.00 WIB). Endpoint memerlukan `CRON_SECRET`; cadangan dan pengingat membutuhkan variabel serta grant yang sesuai. Jadwal dan batas layanan bergantung pada paket Vercel.

Sebelum deployment yang disetujui, cocokkan environment target, skema/grant/RLS, provider Google, Redirect URLs Supabase, dan callback OAuth Gmail dengan domain deployment. Perubahan variabel publik membutuhkan build ulang. Untuk host lain, gunakan `npm run build` dan `npm start` serta siapkan penjadwal Cron sendiri bila diperlukan.

Berkas gambar sosial dan favicon saat ini masih menyimpan branding starter; laporan audit merinci usulan penggantiannya. Manifest dan ikon PWA sudah memakai Budgetku. Jangan menghapus aset metadata hanya karena tidak ditemukan impor: Next.js memuatnya melalui konvensi nama file.

## Panduan kontribusi

Baca [AGENTS.md](AGENTS.md), [aturan workflow](.kiro/steering/budgetku-workflow.md), dan [arah desain](DESIGN.md) sebelum mengubah proyek. Pisahkan perubahan dokumentasi dari perubahan autentikasi, database, kalkulasi, atau performa. Pertahankan pekerjaan lokal, hindari mengunggah data pribadi, dan minta persetujuan pemilik sebelum commit, push, merge, atau deployment.
