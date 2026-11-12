# Audit bidang impor Gmail — 12 November 2026

Catatan implementasi untuk pembahasan perubahan field yang akan diimpor, **tanpa mengubah parser dalam PR ini**.

## Alur saat ini

1. Pengguna menghubungkan akun Gmail melalui OAuth read-only (`gmail.readonly`) dan token disimpan terenkripsi pada server.
2. Tombol **Sync sekarang** memanggil server action `app/(app)/settings/gmail/actions.ts::syncGmail`.
3. `lib/gmail/sync.ts` menggunakan `users.messages.list` dengan query domain dari `lib/gmail/config.ts` untuk BCA (`bca.co.id`), Shopee (`shopee.co.id`, `mail.shopee.co.id`), GoPay (`gopay.co.id`, `gojek.com`), lalu mengambil paling banyak **50 email per sinkronisasi**.
4. `users.messages.get({format:"full"})` membaca header Subject dan From, tanggal diterima, serta body `text/plain` atau HTML yang dijadikan teks.
5. Parser dipilih berdasarkan domain sender (`lib/gmail/parsers/{bca,shopee,gopay}.ts`), dengan hasil draft disimpan ke `email_imports.parsed_preview`. Id Gmail mencegah duplikasi. Email tidak otomatis menjadi transaksi.
6. Pengguna menekan Terima, meninjau/memperbaiki form, memilih rekening dan kategori, lalu menyimpan transaksi. Transfer perlu dipilih eksplisit.

## Field yang dideteksi

| Field draft | Sumber saat ini | Risiko atau batasan |
| --- | --- | --- |
| `amount` | `parseRupiah`: angka berawalan Rp/IDR di body, fallback subject; utamakan label Total Payment, Pay Amount, Amount, Jumlah, Nominal | Jika label tidak ditemukan, memilih **nominal rupiah terbesar**; dapat memilih nilai saldo atau limit yang bukan transaksi |
| `direction` | Kata kunci debit/kredit (BCA), pembayaran/refund (Shopee), transaksi/cashback (GoPay) | Arah bisa ambigu; GoPay selalu low-confidence. Tidak mendeteksi transfer otomatis |
| `transactionAt` | Tanggal dari teks email, fallback tanggal email diterima | Format teks ambigu bisa salah |
| `merchant` | Label merchant / recipient / type pada BCA; nilai generik `Shopee` atau `GoPay` untuk kedua provider lainnya | Tidak selalu sama dengan nama toko sebenarnya |
| `description` | Subject email, fallback nama provider | Bukan otomatis rincian barang / rekening / biaya |
| `confidence` | Hasil heuristik per provider | Bukan jaminan nominal benar |
| `account_id`, `category_id` | Tidak diambil | Wajib dipilih di form review |
| `destination_account_id` | Tidak diambil | Diisi hanya saat pengguna memilih Transfer |

### Penting: presisi desimal

`lib/gmail/parsers/money.ts` saat ini mengonversi Rp/IDR ke bilangan bulat dan **membuang bagian desimal**. Ini tidak konsisten dengan form transaksi Budgetku yang sudah mendukung dua angka desimal (misalnya Rp0,41). Sebelum mengubahnya, siapkan fixture email teranonimisasi dari setiap provider untuk memastikan setiap format nominal diparse tanpa pembulatan atau salah separator.

## Rekomendasi perubahan parser (belum diterapkan)

- Tentukan daftar **field yang benar-benar diinginkan** pengguna dari email, termasuk transaksi utama, biaya admin, reference, pihak penerima, metode/rekening, dan saldo akhir.
- Nominal: hanya percaya label transaksi yang cocok konteks provider. Jika ada lebih dari satu kandidat tetapi tidak bisa dipastikan, tampilkan *Perlu diperiksa*, jangan otomatis memilih terbesar.
- Pisahkan `amount`, `fee`, dan `balance`; jangan menebak semuanya menjadi amount.
- Pertahankan nilai pecahan dua desimal dan provenance: asal baris/label email untuk audit, tanpa menampilkan token atau data sensitif.
- Tambahkan parser fixtures untuk BCA, ShopeePay, GoPay serta kasus refund, transfer, cashback, top-up, saldo dan IDR bilingual.
- **Jangan auto-approve / posting** hanya karena Gmail berhasil mendeteksi nominal.

## Sinkronisasi saat email masuk (belum diterapkan)

Notifikasi push Gmail tidak berasal dari notification center ponsel. Integrasi mendekati real-time membutuhkan **Gmail API users.watch** + **Google Cloud Pub/Sub topic/subscription** + endpoint HTTPS yang memverifikasi asal pesan + `users.history.list` dan idempotency. Google mewajibkan renewal `watch` maksimal tiap tujuh hari (disarankan harian). Sediakan periodic reconciliation karena push bisa terlambat atau hilang; jangan mem-posting ke buku besar tanpa user menyetujui.

Referensi resmi: https://developers.google.com/workspace/gmail/api/guides/push

## Scope PR ini

- Header Duplikat transaksi menggunakan token headline yang sama dengan header aplikasi.
- Tombol **Sync sekarang** pada halaman Transaksi menggunakan action sinkronisasi Gmail yang sama dengan Pengaturan.
- Sinkronisasi memperbarui daftar draft melalui `revalidatePath` dan `router.refresh`; tidak menulis transaksi sampai Terima.
- Tidak ada perubahan schema, parser, OAuth, atau penerimaan draft secara otomatis.
