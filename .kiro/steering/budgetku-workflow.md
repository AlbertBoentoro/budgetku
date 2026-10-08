---
inclusion: always
---
# Budgetku workflow preferences

Preferensi kerja pengguna untuk proyek Budgetku. Berlaku di semua sesi dan untuk semua agent workflow (planner, coder, reviewer, report writer), bukan hanya satu percakapan.

## 1. Persetujuan dan scope
- Persetujuan pengguna berlaku sampai tugas terkait selesai.
- Jangan meminta konfirmasi ulang untuk tindakan atau penyesuaian yang sudah disetujui.
- Baca percakapan dan status pekerjaan sebelum bertanya.
- Instruksi terbaru pengguna mengalahkan aturan proyek jika bertentangan.
- Jangan memperluas scope hanya untuk memenuhi checklist anti-slop.

## 2. Tindakan rutin yang boleh langsung dilakukan
Selama izin tool memungkinkan:
- Membaca dan mencari source, konfigurasi non-rahasia, serta laporan proyek.
- Menjalankan `git status`, `git diff`, `git branch --show-current`.
- Mengedit file dalam scope yang sudah disetujui.
- Menjalankan `npm run lint` tanpa `--fix` dan `npm run build`.
- Menghitung kontras secara lokal.
- Mengecek paket/browser lokal tanpa mengunduh atau menginstal.
- Menulis dan memperbarui laporan verifikasi.
Tindakan ini tidak memerlukan pertanyaan persetujuan tambahan dalam chat.

## 3. Tindakan yang memerlukan persetujuan
- Menghapus file atau menimpa perubahan pengguna yang tidak berkaitan dengan tugas.
- `git reset`, `git clean`, staging/`git add`, commit, push, merge, atau deploy.
- Instalasi/update dependency atau pengunduhan browser.
- Membaca atau mengubah isi file rahasia, token, dan kredensial.
- Mengubah database, auth, Supabase, penyimpanan, atau perhitungan keuangan.
- Menulis di luar proyek.
- Memperluas scope pekerjaan.
Gabungkan keputusan yang berkaitan dalam satu pertanyaan dan jelaskan tindakan konkretnya.

## 4. Jangan mengulang pekerjaan tanpa alasan
- Baca hasil pemeriksaan terbaru sebelum menjalankan pemeriksaan lagi.
- Hasil pemeriksaan bisa digunakan kembali jika file, konfigurasi, dependency, dan kondisi yang relevan belum berubah.
- Ulangi pemeriksaan hanya jika ada perubahan relevan, kegagalan, bukti tidak lengkap, atau kekhawatiran spesifik yang belum terjawab.
- Reviewer gunakan hasil coder yang memiliki perintah, hasil, dan konteks jelas. Jangan menjalankan ulang semua pemeriksaan sekadar mengganti agent.
- Gabungkan perhitungan kontras seluruh pairing yang relevan dalam satu eksekusi.
- Jika browser automation lokal tidak tersedia, catat keterbatasan sekali dan lanjutkan pekerjaan yang bisa dilakukan. Jangan terus mencari instalasi global atau cache setelah ketersediaan lokal sudah dipastikan.
- Jangan memakai `npx` yang dapat mengunduh paket tanpa izin.

## 5. Izin tool
- Preferensi ini bukan izin untuk melewati kontrol keamanan tool.
- Jika tool meminta approval, gunakan mekanisme approval yang tersedia.
- Jangan mengganti tool atau mengubah bentuk perintah untuk menghindari approval.
- Jangan menyarankan Always allow untuk interpreter atau kode bebas seperti `node -e`, `python -c`, atau seluruh PowerShell.
- Jangan menyatakan izin permanen sudah aktif jika belum dikonfigurasi.

## 6. Koordinasi workflow
- Teruskan scope, persetujuan, larangan staging/commit, dan file aturan ini ke planner, coder, reviewer, serta report writer.
- Pastikan agent membaca aturan ini sebelum bekerja.
- Jika custom agent tidak otomatis memuat steering, tambahkan referensinya ke konfigurasi resources yang sesuai dengan mempertahankan resources lainnya. Jangan mengubah konfigurasi global.
- Jangan memulai workflow kedua yang mengedit file sama saat workflow pertama masih berjalan.
- Perubahan aturan ini tidak menjadi alasan untuk memulai ulang tugas aktif.

## 7. Bukti dan pelaporan
- Catat pemeriksaan di satu laporan tugas yang sudah digunakan workflow: perintah, hasil/exit code, file yang diperiksa, dan hal yang belum diverifikasi.
- Laporan akhir cukup memuat perubahan, hasil pemeriksaan, dan keterbatasan.
- Jangan mengklaim browser PASS dari lint/build atau perhitungan kontras saja.
- Hindari update berulang yang tidak memberi informasi baru.
- Jika tugas tertahan, sebutkan blocker konkret dan tindakan yang dibutuhkan.
