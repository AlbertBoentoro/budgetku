-- Budgetku — add unique indexes that make Gmail import duplicate-proof
-- Date: 2026-10
--
-- WHY: the Gmail import dedups with select-then-insert (BLOCKER-1 / BLOCKER-3).
-- Without a unique index, two syncs or two "Impor" clicks running at the same
-- time can both pass the select and both insert, creating a duplicate
-- email_imports row or a duplicate transactions row for the same email.
--
-- WHAT: two unique indexes, both per-user:
--   1. email_imports (user_id, gmail_message_id)
--   2. transactions  (user_id, source, source_reference)
--        PARTIAL: where source = 'email' and source_reference is not null
--
-- PENTING — kenapa index transactions dibatasi source = 'email':
--   Transaksi berulang (app/(app)/recurring/actions.ts) menyimpan
--   source = 'recurring' dan source_reference = id template. Setiap kali
--   jadwal dicatat, source_reference yang SAMA dipakai lagi — itu memang
--   disengaja. Kalau index berlaku untuk semua source, pencatatan transaksi
--   berulang kedua dan seterusnya akan GAGAL. Jadi index hanya berlaku untuk
--   transaksi hasil impor email. Transaksi manual (source_reference null)
--   juga tidak terpengaruh.
--
-- This does NOT touch RLS, policies, grants, or any data. It only adds indexes.
-- SAFE TO RE-RUN: "create unique index if not exists" is a no-op the second time.
-- Read-only? No — STEP 2 changes the schema. STEP 1 is read-only.
--
-- CARA MENJALANKAN (Supabase Studio → SQL Editor):
--   1. Jalankan dulu blok STEP 1 saja (pre-check, hanya membaca data).
--   2. Kalau kedua query STEP 1 mengembalikan 0 baris → lanjut jalankan STEP 2.
--   3. Kalau ada baris → JANGAN jalankan STEP 2 dulu. Baca bagian
--      "JIKA ADA DUPLIKAT" di bawah, selesaikan duplikatnya, ulangi STEP 1.
--   Catatan: "create index concurrently" tidak dipakai karena SQL Editor
--   menjalankan skrip dalam transaksi; tabel ini kecil sehingga lock-nya singkat.

-- ===========================================================================
-- STEP 1 — PRE-CHECK (read-only). Expected result: 0 rows for both queries.
-- ===========================================================================

-- 1a. Duplicate email_imports per (user_id, gmail_message_id).
select
  user_id,
  gmail_message_id,
  count(*)                                         as duplicate_count,
  array_agg(id             order by created_at)    as import_ids,
  array_agg(status         order by created_at)    as statuses,
  array_agg(transaction_id order by created_at)    as transaction_ids,
  array_agg(created_at     order by created_at)    as created_ats
from public.email_imports
group by user_id, gmail_message_id
having count(*) > 1
order by duplicate_count desc, user_id, gmail_message_id;

-- 1b. Duplicate email-imported transactions per (user_id, source, source_reference).
--     Scoped to source = 'email' — same predicate as the partial index below.
select
  user_id,
  source,
  source_reference,
  count(*)                                    as duplicate_count,
  array_agg(id             order by created_at) as transaction_ids,
  array_agg(amount         order by created_at) as amounts,
  array_agg(transaction_at order by created_at) as transaction_ats,
  array_agg(created_at     order by created_at) as created_ats
from public.transactions
where source = 'email'
  and source_reference is not null
group by user_id, source, source_reference
having count(*) > 1
order by duplicate_count desc, user_id, source_reference;

-- ---------------------------------------------------------------------------
-- JIKA ADA DUPLIKAT
--
-- STEP 2 akan GAGAL (error 23505 / "could not create unique index") selama
-- masih ada duplikat. Tidak ada data yang berubah saat gagal; selesaikan
-- duplikatnya dulu, lalu jalankan STEP 1 dan STEP 2 lagi.
--
-- Periksa setiap grup secara manual:
--
-- email_imports (hasil 1a):
--   - Pertahankan baris yang punya transaction_id (status 'imported'), karena
--     baris itu terhubung ke transaksi yang sudah tercatat.
--   - Kalau tidak ada yang punya transaction_id, pertahankan baris PALING AWAL
--     (elemen pertama di import_ids), hapus sisanya.
--   - Kalau LEBIH DARI SATU baris punya transaction_id, berarti transaksinya
--     juga dobel → selesaikan dulu duplikat di transactions (1b), lalu
--     pertahankan baris email_imports yang menunjuk ke transaksi yang disimpan.
--
-- transactions (hasil 1b):
--   - Ini menyangkut saldo. Buka transaksinya di aplikasi (menu Transaksi) dan
--     pastikan memang dobel (nominal & tanggal sama) sebelum menghapus.
--   - Pertahankan transaksi yang dirujuk email_imports.transaction_id; kalau
--     tidak ada yang dirujuk, pertahankan yang PALING AWAL (elemen pertama di
--     transaction_ids). Hapus sisanya lewat aplikasi bila memungkinkan.
--
-- Contoh pembersihan di bawah ini SENGAJA dikomentari dan HANYA untuk dijalankan
-- MANUAL setelah Anda meninjau hasil STEP 1. Ganti '<id>' dengan id yang
-- benar-benar ingin dihapus. Jangan jalankan tanpa meninjau.
--
-- -- [MANUAL] hapus satu baris email_imports duplikat:
-- -- delete from public.email_imports
-- -- where id = '<id-email-import-duplikat>'
-- --   and transaction_id is null;
--
-- -- [MANUAL] hapus satu transaksi email duplikat (pastikan tidak dirujuk):
-- -- delete from public.transactions t
-- -- where t.id = '<id-transaksi-duplikat>'
-- --   and t.source = 'email'
-- --   and not exists (
-- --     select 1 from public.email_imports ei where ei.transaction_id = t.id
-- --   );
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- STEP 2 — CREATE UNIQUE INDEXES. Run only after STEP 1 returns 0 rows.
-- ===========================================================================

create unique index if not exists email_imports_user_id_gmail_message_id_key
  on public.email_imports (user_id, gmail_message_id);

create unique index if not exists transactions_user_id_source_source_reference_email_key
  on public.transactions (user_id, source, source_reference)
  where source = 'email' and source_reference is not null;

-- ---------------------------------------------------------------------------
-- Verify afterwards (optional): should list both indexes.
-- select tablename, indexname, indexdef from pg_indexes
-- where schemaname = 'public'
--   and indexname in (
--     'email_imports_user_id_gmail_message_id_key',
--     'transactions_user_id_source_source_reference_email_key'
--   );
-- ---------------------------------------------------------------------------
