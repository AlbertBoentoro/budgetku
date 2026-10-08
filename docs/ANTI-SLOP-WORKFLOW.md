# Memakai anti-slop di Budgetku

## Integrasi yang dipasang
Instalasi manual lokal proyek, tanpa npm dependency, tanpa plugin global, tanpa perubahan UI atau logic. Sumber: https://github.com/miqdadbadjuber/anti-slop, versi 3.2.20, commit 388cbe3b6c37d5175b9f460015bb092ef9e34894. `antislop.md` dan enam folder `.agents/skills/antislop*` disalin tanpa perubahan. Lisensi MIT berada di `docs/anti-slop/LICENSE`; metadata snapshot berada di `UPSTREAM.json`.

AGENTS.md mengarahkan agent ke filter dan skill concern. DESIGN.md mengadaptasi brief pengguna yang tersedia dan menyatakan interpretasi implementasinya. `.kiro/steering/budgetku-antislop.md` memuat arah dan routing bersama. `docs/CHATGPT-PROJECT-INSTRUCTIONS.md` adalah teks yang dapat ditempel ke instruksi proyek ChatGPT.

Ini memasang panduan agent, bukan lint otomatis atau perbaikan visual. ESLint tidak dapat memastikan komposisi terasa spesifik atau bahwa suatu klaim benar. Karena source aplikasi tidak diubah, lint/build UI tidak dijalankan untuk pemasangan ini. UI yang ada belum diaudit; misalnya AmountText masih memakai USD/en-US dan root HTML masih en. IDR/Indonesia di DESIGN.md adalah target pekerjaan UI berikutnya, bukan klaim telah diterapkan.

## Kiro
Buka D:\Projects\budgetku sebagai workspace. Mulai chat baru dan pastikan budgetku-antislop muncul di Steering dengan inclusion always. Referensi file harus ter-resolve. Contoh prompt:

Gunakan antislop during. Baca AGENTS.md, DESIGN.md, antislop.md dan skill UI/copy/mobile/accessibility yang relevan. Rapikan visual dashboard sesuai brief Budgetku. Pertahankan logic auth/data/perhitungan dan jangan tambah fitur. Nyatakan Design Read lalu verifikasi perubahan dan laporkan empat blok Delivery Gate dengan bukti.

Untuk custom agent Kiro yang tidak memuat steering otomatis, tambahkan pola `file://.kiro/steering/**/*.md` ke daftar resources yang sudah ada; jangan mengganti konfigurasi resources lain. Panduan resmi: https://kiro.dev/docs/steering/.

## Codex
Buka Budgetku sebagai proyek lalu mulai sesi baru agar AGENTS.md root terbaca. Enam skill berada pada jalur lokal `.agents/skills/`. Gunakan contoh prompt yang sama. Untuk audit tanpa edit:

Gunakan antislop after. Audit dashboard dengan DESIGN.md dan aturan proyek, buat temuan bernomor dengan R-XX, prioritas, serta bukti. Jangan ubah source dulu.

Mode during/after dipilih sesuai core; instalasi ini tidak mengubah preferensi global. Tidak perlu memasang plugin global lagi untuk memakai aturan proyek. Panduan AGENTS.md: https://learn.chatgpt.com/docs/agent-configuration/agents-md.

## ChatGPT biasa
Chat biasa tidak otomatis membaca file di drive D:. Unggah DESIGN.md dan antislop.md ke proyek ChatGPT, serta skill concern jika dibutuhkan. Tempel isi docs/CHATGPT-PROJECT-INSTRUCTIONS.md ke instruksi proyek. File ini disiapkan lokal; pengaturan akun ChatGPT belum diubah. Instruksi ringkas juga dapat ditempel bersama file ke chat baru. Saat meminta prompt Kiro, minta prompt merujuk ke file aturan proyek dan scope yang konkret.

## Pemeriksaan desain berikutnya
Verifikasi viewport 320, 375/390, 768 dan 1280 px; saldo IDR panjang; keyboard Tab/Enter/Escape; kontras AA; reduced motion; tema yang didukung; serta keadaan empty/loading/error pada komponen yang berubah. Catat hasil nyata. Build/lint saja tidak membuktikan gate UI lulus. Untuk perubahan panduan saja, periksa integritas snapshot dan referensi.

## Update dan pelepasan
Karena ini snapshot manual, jangan mengasumsikan npx antislop-ai --update memperbarui antislop.md root atau adapter Budgetku. Unduh versi repo yang dipilih, periksa perubahan, lalu ganti core dan seluruh folder skill bersama-sama; pertahankan adapter dan DESIGN.md proyek, perbarui metadata dan lisensi, serta mulai sesi baru. Jangan mencampur versi core dan skill.

Untuk melepas, hapus hanya file integrasi yang tercantum di panduan ini dan enam folder skill antislop. Pertahankan `.agents/tasks` dan file proyek lain. Jangan menghapus direktori `.agents` keseluruhan.
