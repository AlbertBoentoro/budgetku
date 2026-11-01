# Ikon Budgetku

Aset PNG berikut sudah dilacak di repositori. Sumber vektornya adalah
`budgetku-ledger.svg`, dengan tanda buku besar Rupiah pada palet navy dan emerald.

| Berkas | Ukuran | Pemakaian |
| --- | --- | --- |
| `budgetku-ledger.svg` | viewBox 512×512 | Logo pada header `components/layout/app-frame.tsx` dan sumber artwork. |
| `icon-192.png` | 192×192 | `app/manifest.ts`, serta ikon/badge notifikasi dalam `public/service-worker.js`. |
| `icon-512.png` | 512×512 | Ikon standar manifest (`purpose: any`). |
| `icon-512-maskable.png` | 512×512 | Ikon manifest (`purpose: maskable`). |
| `apple-touch-icon.png` | 180×180 | Direferensikan secara eksplisit oleh metadata `icons.apple` di `app/layout.tsx`. |

Pertahankan nama berkas agar referensi URL tetap benar. Saat memperbarui artwork,
regenerasi varian PNG dari sumber yang sama dan periksa hasilnya. Belum ada skrip
regenerasi ikon yang disimpan di repositori.

Untuk varian maskable, tempatkan seluruh tanda penting di dalam lingkaran aman
berpusat dengan radius 40% dari lebar gambar; margin persegi 10% saja tidak
menjamin sudut tanda tetap terlihat. Varian saat ini tampak sama dengan ikon
standar; bentuk buku dapat terpotong pada mask tertentu. Periksa preview mask
sebelum mengganti aset, tanpa menganggap status manifest membuktikan safe area.

Favicon berada di `app/favicon.ico`; gambar berbagi sosial berada di
`app/opengraph-image.png` dan `app/twitter-image.png`. Next.js memakai ketiganya
melalui konvensi metadata, bukan impor komponen. Audit menemukan favicon Vercel
dan gambar sosial starter pada ketiga berkas tersebut. Penggantian branding
masih merupakan usulan terpisah dalam
[laporan cleanup](../../docs/repository-cleanup-audit.md); aset tidak dihapus.
