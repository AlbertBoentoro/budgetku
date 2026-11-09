# Budgetku — Kontrak Login Environment

**Keputusan pemilik aplikasi (9 November 2026):** perbedaan login ini wajib dipertahankan di seluruh PR, preview, staging, dan rilis berikutnya.

## Development / Testing / Staging
- Gunakan **email + password** melalui `Masuk ke Testing` dan `Daftar Akun Testing`, bukan Google OAuth.
- Gunakan akun yang terdaftar di proyek Supabase staging, **omnzuolrlwczvnxrvenw**.
- Form login testing hanya aktif bila `VERCEL_ENV !== "production"` dan `NEXT_PUBLIC_SUPABASE_URL` **persis** `https://omnzuolrlwczvnxrvenw.supabase.co`.
- Jangan mengaitkan tampilnya login testing dengan flag Smart Restore, backup, atau pengujian fitur lain; fitur tersebut punya izin dan gating berbeda.
- Preview Vercel yang dipakai untuk pengujian pengguna harus mempunyai `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari Supabase staging.
- Jangan menyalin kredensial, data, saldo, email Gmail sungguhan, atau rekening production ke staging.
- Jika staging belum punya akun pengguna, gunakan opsi pendaftaran testing; jangan mencoba Google login.

## Production
- Tetap memakai **Google OAuth login** dan Supabase production **zvmqrrttdrqkyrdzyxlf**.
- Jangan tampilkan login email/password testing di production.
- Jangan mengubah sistem autentikasi production untuk memenuhi kebutuhan testing.

## Aturan pengujian
1. Uji `/auth/login` pada preview staging: form email dan password + opsi Masuk/Daftar Testing harus tersedia; tombol Google tidak ditampilkan.
2. Pastikan domain production tetap Google-only.
3. Jika staging login tidak terlihat, periksa mapping env Supabase dahulu, lalu gate `isStagingEmailLoginAllowed`; **jangan membuat sistem login baru atau mengaktifkan Smart Restore**.
4. Jalankan regresi `tests/staging-email-login.test.mjs` saat mengubah auth/deployment.
