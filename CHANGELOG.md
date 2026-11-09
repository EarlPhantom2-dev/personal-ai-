# Riwayat perubahan

## 2026-11-08 — Fondasi Personal AI Agent

- Membuat ulang proyek dalam workspace kosong sesuai target FastAPI, PostgreSQL/pgvector, 9Router, web chat, ARM64, dan Oracle Cloud.
- Menambahkan sesi login, pembatasan login, header keamanan, penyimpanan chat, pengelolaan memori, dan UI responsif.
- Menambahkan Compose untuk PostgreSQL, aplikasi, 9Router resmi ARM64, Caddy HTTPS, dan backup terenkripsi.
- Menambahkan panduan arsitektur, deployment Oracle, serta pemulihan backup.
- Tidak ada arsip atau kode awal tersedia; implementasi ini dibuat baru dari spesifikasi pengguna.

## 2026-11-09 — Hardening dan persiapan rilis

- Menambahkan layanan resmi 9Router yang dipin, mengunci akses API dengan key, dan membatasi dashboard ke loopback.
- Menambahkan konfirmasi penghapusan chat/memori, navigasi mobile untuk riwayat dan memori, serta rute asset statik.
- Mengganti backup simetris menjadi enkripsi streaming `age` agar dump plaintext tidak ditulis ke disk dan kunci privat tidak masuk ke container backup.
- Memperbarui dependency serta dokumentasi deployment sesuai image ARM64 dan paket yang tersedia.
- Menambahkan satu catatan repo tentang pekerjaan lanjutan untuk migrasi skema, pengujian, memori, keamanan, backup, deployment, dan observabilitas.

## 2026-11-09 — Integrasi API key 9Router

- Menyimpan `API_KEY_SECRET` acak 9Router secara persisten di `.env` agar API key Endpoint yang dibuat di dashboard tetap valid di bootstrap dan layanan Compose.
- Menjelaskan perbedaan API key Endpoint 9Router dan kredensial provider AI; aplikasi memakai key Endpoint melalui header Bearer pada API OpenAI-compatible `/v1`.
- Memperbarui panduan setup agar secret 9Router di `.env` tetap privat dan konsisten.
