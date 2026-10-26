# Pengaturan dan integrasi

Fitur ini membutuhkan skema Supabase dan environment server sebelum kontrol
cadangan otomatis, notifikasi, serta passkey dapat diaktifkan. Kode tidak
menerapkan perubahan ke Supabase live atau Vercel.

## Menyiapkan Supabase

Jalankan [2026-10-settings-integrations.sql](./sql/2026-10-settings-integrations.sql)
sekali di SQL Editor project Supabase. Migrasi membuat tabel preferensi,
langganan push, kredensial passkey, challenge sekali pakai, bucket privat
`budgetku-backups`, serta kebijakan akses per pengguna.

Cadangan hanya menyimpan data finansial dan preferensi. Kredensial OAuth Gmail,
langganan push, dan kunci passkey tidak masuk ke file cadangan. Aplikasi
menyimpan satu file cloud terbaru per akun. File JSON dapat diunduh, tetapi
belum ada fungsi pemulihan otomatis dari file tersebut.

## Environment server

Isi nilai berikut pada environment lokal atau Vercel. Jangan masukkan key
rahasia ke variabel `NEXT_PUBLIC_*`, source code, atau chat.

| Variabel | Kegunaan |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Pekerjaan terjadwal dan perubahan server-side pada kredensial passkey. Hanya server. |
| `CRON_SECRET` | Mengautentikasi endpoint Cron. Gunakan nilai acak yang panjang. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Kunci publik untuk pendaftaran Web Push. |
| `VAPID_PRIVATE_KEY` | Kunci privat pengiriman Web Push. Hanya server. |
| `VAPID_SUBJECT` | Kontak VAPID, misalnya `mailto:alamat-kontak`. |
| `PASSKEY_SESSION_SECRET` | Penandatangan cookie sesi passkey, minimal 32 karakter. |
| `NEXT_PUBLIC_SITE_URL` | Origin utama HTTPS untuk verifikasi passkey. Lokal dapat memakai `http://localhost:3000`. |

Pasangan VAPID harus berasal dari satu proses pembuatan kunci yang sama.
Browser harus mendukung Web Push dan pengguna harus memberi izin notifikasi.

## Menyiapkan project test atau Vercel

### Supabase

1. Buka project Supabase **test** yang dipakai oleh aplikasi lokal.
2. Buka **SQL Editor**, buat query baru, lalu salin seluruh isi
   `docs/sql/2026-10-settings-integrations.sql` dan jalankan.
3. Pastikan query berhasil. Di Table Editor, cek tabel `user_settings`,
   `push_subscriptions`, `passkey_credentials`, dan `passkey_challenges`.
   Di Storage, pastikan bucket privat `budgetku-backups` tersedia.

Jangan jalankan langkah ini di project produksi tanpa persetujuan khusus.

### Vercel

Di project Vercel, buka **Settings → Environment Variables**. Tambahkan
variabel berikut untuk **Production**. Pilih Preview juga hanya jika ingin
memakai fitur tersebut di deployment Preview.

| Variabel | Cara mendapat nilainya |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **Project Settings → API Keys**. Gunakan service role/secret key, jangan pernah pakai prefix `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Buat nilai acak dengan password manager atau `openssl rand -base64 32`. |
| `PASSKEY_SESSION_SECRET` | Buat secret berbeda dengan password manager atau `openssl rand -base64 48`; minimal 32 karakter. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` dan `VAPID_PRIVATE_KEY` | Dari root repo jalankan `./node_modules/.bin/web-push generate-vapid-keys`; simpan pasangan yang sama, private key server-only. |
| `VAPID_SUBJECT` | Kontak yang dapat dihubungi dalam format `mailto:alamat-kontak`. |
| `NEXT_PUBLIC_SITE_URL` | URL production aplikasi, termasuk `https://`. |

Masukkan secret langsung di dashboard Vercel, bukan ke chat atau Git. Vercel
Cron berjalan pada deployment Production. Setelah migrasi test berhasil dan
semua variabel production benar, barulah push commit dan periksa deployment.
Jangan push sebelum database siap, karena halaman Pengaturan akan menampilkan
error saat tabel atau kolom belum tersedia.

## Jadwal

`vercel.json` menjalankan `/api/cron/settings` setiap hari pada 13:00 UTC,
setara sekitar pukul 20.00 WIB. Jadwal Cron Vercel Hobby dapat terlambat hingga
sekitar satu jam. Cron membuat cadangan terbaru dan mengirim pengingat untuk akun yang
mengaktifkannya. `CRON_SECRET` wajib ada; request harus membawa header
otorisasi dengan secret Cron yang benar.

## Passkey dan pemulihan

Passkey memakai verifikasi WebAuthn server-side, challenge sekali pakai, dan
cookie bertanda tangan yang berlaku 12 jam. Jika perangkat passkey hilang,
pengguna dapat keluar lalu masuk kembali dengan Google untuk menonaktifkan
passkey lama dan mendaftarkan yang baru.

Pengaturan menyediakan pilihan Senin atau Minggu sebagai awal minggu. Nilainya
disimpan di `user_settings.first_day_of_week`. Laporan Budgetku yang tersedia
saat ini masih berbasis bulanan, jadi pilihan ini belum mengubah rentang
laporan lain.

## Status verifikasi implementasi

- `npm run lint`: lulus.
- `npm run build`: lulus setelah penambahan preferensi awal minggu. Next.js
  masih memberi warning konfigurasi `partialPrefetching` yang sudah ada.
- `git -c core.whitespace=cr-at-eol diff --check`: lulus.
- Login Google lokal berhasil sampai callback aplikasi, lalu halaman
  Pengaturan terbuka. Ini memastikan tombol Google bekerja, bukan berarti
  proses login dapat dilakukan tanpa pengguna menyelesaikan autentikasi Google.
- Tema Terang, Gelap, dan Sistem merespons klik. Fokus keyboard pada opsi Gelap
  dan aktivasi Enter juga berhasil; tema dikembalikan ke Terang.
- Pada shell halaman Pengaturan, viewport 320, 375, 768, dan 1024 piksel tidak
  menunjukkan overflow horizontal. Form preferensi belum tampil saat diuji.
- Karena migrasi belum diterapkan, bagian Preferensi, Keamanan, dan Cadangan
  menampilkan error pemuatan. Simpan pilihan minggu, backup, Web Push, passkey,
  ekspor data, dan validasi visual form belum dapat diuji end-to-end.
- Klik navigasi, pemeriksaan tema secara visual, pembesaran teks, dan status
  empty/loading/error setelah migrasi juga belum diverifikasi. UI belum lulus
  Delivery Gate dan belum siap di-deploy.
