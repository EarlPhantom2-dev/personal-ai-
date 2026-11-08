# Catatan pengembangan berikutnya

Fondasi awal sudah mencakup chat web satu pengguna, penyimpanan PostgreSQL/pgvector, 9Router, Compose ARM64, HTTPS, dan backup terenkripsi. Pekerjaan berikut akan membuatnya lebih siap dipakai jangka panjang:

1. **Migrasi skema:** Tambahkan Alembic dan jalur upgrade/rollback sebelum perubahan model database berikutnya.
2. **Pengujian:** Tambahkan unit dan integration tests untuk login, sesi, chat, pencarian vektor lintas dimensi, fallback embeddings, penghapusan data, dan backup/restore. Jalankan Compose di ARM64 serta workflow CI untuk build dan pemeriksaan image.
3. **Kualitas memori:** Biarkan pengguna menyimpan fakta secara eksplisit, menggabungkan memori berulang, melihat kapan memori dipakai, dan mengekspor/menghapus seluruh data.
4. **Keamanan sesi:** Pindahkan rate limit login ke penyimpanan persisten, tambah rotasi kata sandi aplikasi, dan sediakan logout semua sesi.
5. **Operasi backup:** Tambahkan salinan off-site otomatis dengan retensi, notifikasi kegagalan, serta uji restore berkala.
6. **Kesiapan deployment:** Otomatiskan provisioning OCI dengan Terraform, konfigurasi DNS/TLS, firewall, pembaruan OS, dan prosedur pemulihan instance.
7. **Observabilitas dan kapasitas:** Tambahkan log operasional tanpa isi pesan, metrik penggunaan, pemeriksaan provider, serta panduan kapasitas dan batas disk.
8. **Alur 9Router:** Buat validasi setup yang memeriksa key, model chat, model embedding, dan konektivitas sebelum aplikasi dianggap siap.

Pekerjaan deployment dan penggunaan provider perlu divalidasi pada instance OCI ARM64 dengan kredensial 9Router milik operator. Arsip yang dibuat tidak menyertakan rahasia atau data aplikasi.
