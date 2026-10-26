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

1. Terapkan file SQL di Supabase **project test** melalui SQL Editor. File
   menambahkan kolom `first_day_of_week` serta tabel, RPC, kebijakan, dan
   bucket yang dibutuhkan fitur Pengaturan.
2. Tambahkan variabel pada environment lokal atau Vercel. Jangan kirim nilai
   secret ke chat atau commit ke Git.
3. Buat pasangan VAPID dari root project dengan
   `./node_modules/.bin/web-push generate-vapid-keys`. Simpan public key ke
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, private key ke `VAPID_PRIVATE_KEY`.
4. Buat nilai acak untuk `CRON_SECRET` dan `PASSKEY_SESSION_SECRET` dengan
   password manager atau pembuat secret tepercaya. `PASSKEY_SESSION_SECRET`
   harus memiliki setidaknya 32 karakter.
5. Ambil `SUPABASE_SERVICE_ROLE_KEY` dari pengaturan API Supabase dan isi hanya
   sebagai server-side environment variable. Isi `VAPID_SUBJECT` dengan kontak
   yang dapat dihubungi, misalnya alamat `mailto:`, dan
   `NEXT_PUBLIC_SITE_URL` dengan origin aplikasi.
6. Setelah migrasi dan environment terpasang, deploy ulang agar route Cron dan
   fitur terkait tersedia. Jangan deploy sebelum migrasi berhasil diterapkan.

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
