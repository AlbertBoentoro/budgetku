# Pengaturan dan integrasi

Fitur ini membutuhkan skema Supabase dan environment server untuk cadangan
otomatis dan notifikasi. Kode tidak menerapkan perubahan ke
Supabase live atau Vercel.

## Preview impor Gmail

Sebelum deploy versi yang menampilkan detail email impor, jalankan
[2026-10-add-gmail-parsed-preview.sql](./sql/2026-10-add-gmail-parsed-preview.sql)
di SQL Editor project Supabase. Migrasi menambahkan kolom JSONB untuk preview
hasil parser. Hak `UPDATE` dan kebijakan RLS yang sudah dipakai tabel
`email_imports` tetap berlaku. Preview hanya membantu pengguna memeriksa draft,
dan tidak membuat transaksi.

## Menyiapkan Supabase

Jalankan [2026-10-settings-integrations.sql](./sql/2026-10-settings-integrations.sql)
di SQL Editor project Supabase. Migrasi membuat tabel preferensi,
langganan push, bucket privat
`budgetku-backups`, serta kebijakan akses per pengguna.

Jika migrasi sudah dijalankan sebelum perubahan grant terbaru, jalankan
grant tambahan yang diperlukan dari SQL Editor. Untuk perbaikan penyimpanan
preferensi dan status cadangan, jalankan:

```sql
grant update (
  user_id, locale, currency, first_day_of_week, daily_reminder_enabled,
  daily_reminder_time, cloud_backup_enabled, updated_at, last_backup_at
) on public.user_settings to authenticated;
grant insert (last_backup_at)
  on public.user_settings to authenticated;
```

Kebijakan RLS tetap membatasi perubahan pada baris milik pengguna yang sedang
masuk. Jangan jalankan ulang seluruh migrasi untuk menambahkan grant.

Cadangan otomatis dibuat setiap hari untuk semua akun Budgetku yang terdaftar
di Supabase Auth. Pengguna tidak perlu mengaktifkannya. Satu file cloud terbaru
disimpan per akun dan digantikan pada jadwal berikutnya. Cadangan mencakup data
finansial dan preferensi, tetapi tidak mencakup kredensial OAuth Gmail,
atau langganan push. File JSON dapat diunduh, tetapi belum ada fungsi
pemulihan otomatis dari file tersebut. Kolom `cloud_backup_enabled` tetap ada
di skema lama, tetapi tidak lagi menentukan apakah Cron membuat cadangan.

## Environment server

Isi nilai berikut pada environment lokal atau Vercel. Jangan masukkan key
rahasia ke variabel `NEXT_PUBLIC_*`, source code, atau chat.

| Variabel | Kegunaan |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Pekerjaan terjadwal (cadangan dan pengingat). Hanya server. |
| `CRON_SECRET` | Mengautentikasi endpoint Cron. Gunakan nilai acak yang panjang. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Kunci publik untuk pendaftaran Web Push. |
| `VAPID_PRIVATE_KEY` | Kunci privat pengiriman Web Push. Hanya server. |
| `VAPID_SUBJECT` | Kontak VAPID, misalnya `mailto:alamat-kontak`. |
| `NEXT_PUBLIC_SITE_URL` | Origin utama HTTPS aplikasi. Lokal dapat memakai `http://localhost:3000`. |

Pasangan VAPID harus berasal dari satu proses pembuatan kunci yang sama.
Browser harus mendukung Web Push dan pengguna harus memberi izin notifikasi.

## Menyiapkan Supabase dan Vercel

### Supabase

1. Pastikan target Supabase benar. Jika hanya ada project production,
   perubahan SQL dan penyimpanan dari aplikasi lokal akan memakai database
   production.
2. Jika migrasi belum diterapkan, buka **SQL Editor**, buat query baru, lalu
   jalankan `docs/sql/2026-10-settings-integrations.sql`.
3. Jika migrasi sudah diterapkan, jalankan hanya grant yang belum ada, bukan
   seluruh file migrasi.
4. Pastikan query berhasil. Di Table Editor, cek tabel `user_settings`,
   dan `push_subscriptions`.
   Di Storage, pastikan bucket privat `budgetku-backups` tersedia.

### Vercel

Di project Vercel, buka **Settings → Environment Variables**. Tambahkan
variabel berikut untuk **Production**. Pilih Preview juga hanya jika ingin
memakai fitur tersebut di deployment Preview.

| Variabel | Cara mendapat nilainya |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **Project Settings → API Keys**. Gunakan service role/secret key, jangan pernah pakai prefix `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Buat nilai acak dengan password manager atau `openssl rand -base64 32`. |
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
sekitar satu jam. Cron membuat cadangan terbaru untuk setiap akun Supabase Auth,
lalu mengirim pengingat untuk akun yang mengaktifkannya. `CRON_SECRET` wajib
ada; request harus membawa header otorisasi dengan secret Cron yang benar.

## Kunci biometrik (dihapus)

Fitur passkey/Face ID sudah dihapus dari aplikasi. Untuk membersihkan sisa
tabel dan fungsinya di Supabase, jalankan opsional
[2026-10-remove-passkeys.sql](./sql/2026-10-remove-passkeys.sql).

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
  menunjukkan overflow horizontal. Setelah migrasi dijalankan, halaman
  Pengaturan dan pilihan awal minggu berhasil dimuat.
- Setelah grant `user_id` dijalankan, menyimpan preferensi tanpa perubahan dan
  memuat ulang halaman berhasil mempertahankan pilihan Senin.
- Tes backup satu kali berhasil setelah grant tambahan dijalankan. Status
  waktu cadangan tampil, endpoint unduh mengembalikan HTTP 200, dan JSON
  memiliki bentuk backup Budgetku yang diharapkan.
- Cadangan otomatis dan pengingat harian sudah diaktifkan dan tersimpan pada
  akun production. Pengiriman terjadwal belum diverifikasi; Vercel Cron perlu
  deployment terbaru dan environment production yang lengkap.
- Endpoint konfigurasi Web Push mengembalikan HTTP 200 dan Cron menolak request
  tanpa autentikasi dengan HTTP 401. Izin notifikasi browser lokal berstatus
  ditolak, sehingga subscription perangkat belum didaftarkan.
- Ekspor data belum diuji end-to-end. Browser automation tidak dapat
  mengubah izin notifikasi yang sudah ditolak; izin untuk localhost perlu
  diubah manual di pengaturan browser sebelum subscription dapat didaftarkan.
- Domain deployment yang dibuka saat pengujian masih menampilkan halaman
  Pengaturan versi lama, tanpa fitur integrasi baru. Environment variables
  Vercel belum dapat diverifikasi dari dashboard; cocokkan nama variabel di
  tabel Environment server sebelum mengandalkan Cron.
- Klik navigasi, pemeriksaan tema secara visual, pembesaran teks, dan status
  empty/loading/error setelah migrasi juga belum diverifikasi. UI belum lulus
  Delivery Gate dan belum siap di-deploy.
