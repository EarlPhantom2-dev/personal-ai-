# Personal AI Agent

Asisten AI privat untuk satu pengguna. Aplikasi berjalan dengan FastAPI, PostgreSQL + pgvector, 9Router, dan antarmuka chat web. Compose menyertakan layanan 9Router dan mendukung image ARM64; target deployment adalah Oracle Cloud Ubuntu 24.04 ARM64, 2 OCPU, RAM 12 GB.

## Fitur

- Login kata sandi dengan cookie sesi aman, pembatasan percobaan login, dan header keamanan.
- Chat tersimpan di PostgreSQL, daftar percakapan dapat dibuka dan dihapus.
- Memori tersimpan menggunakan embedding 9Router dan pencarian cosine pgvector; bila layanan embedding sementara gagal, aplikasi mengambil memori terbaru.
- UI web responsif. Konten pesan dirender sebagai teks, bukan HTML.
- Backup PostgreSQL otomatis harian, terenkripsi, dengan retensi yang dapat diatur.
- Deployment lewat Docker Compose, reverse proxy Caddy, dan HTTPS otomatis.

## Jalankan di server

Perlu Docker Engine dengan Docker Compose v2, OpenSSL, dan `age` (`sudo apt install age`). Dari Ubuntu, clone repo, lalu jalankan:

```bash
cp .env.example .env
bash scripts/start-9router-bootstrap.sh
```

Masuk ke dashboard 9Router yang tersedia di loopback port 20128, ubah kata sandi awal `123456`, sambungkan provider, lalu catat API key serta nama model chat dan embedding. Hapus container bootstrap setelah selesai; data router tetap ada di volume Docker:

```bash
docker rm -f personal-ai-ninerouter-bootstrap
```

Script berikut meminta nilai tersebut bersama kata sandi aplikasi, lalu membuat secret acak sesi, PostgreSQL, dan pasangan kunci `age` untuk backup:

```bash
bash scripts/init-secrets.sh
```

Simpan salinan aman dari `./.secrets/backup_age_key` di luar server; tanpa kunci privat ini, backup terenkripsi tidak dapat dipulihkan.

Jalankan layanan:

```bash
docker compose up -d --build
```

API key dan model 9Router sudah disimpan oleh script penyiapan. Jika Anda mengubahnya kemudian, perbarui `.secrets/ninerouter_api_key` dan nilai model di `.env`. Restart aplikasi sesudah mengubah konfigurasi:

```bash
docker compose restart app
```

Aplikasi lokal ada di `http://127.0.0.1:8000`. Jika `COOKIE_SECURE=true`, akses lewat HTTPS atau gunakan tunnel HTTPS; untuk uji lokal sementara, atur `COOKIE_SECURE=false` di `.env`.

## HTTPS dan backup

Untuk domain yang DNS-nya mengarah ke server, atur `DOMAIN=ai.example.com` di `.env`, buka TCP 80/443 ke server, lalu mulai Caddy:

```bash
docker compose --profile tls up -d --build
```

Aktifkan backup harian:

```bash
mkdir -p backups
docker compose --profile backup up -d
```

Backup terenkripsi tersimpan di `./backups` sebagai file `.dump.age`. Simpan salinan di lokasi lain dan jaga kunci privat secara terpisah. Pemulihan mengganti data aktif dan meminta konfirmasi:

```bash
bash scripts/restore.sh backups/personal-ai-YYYYMMDDTHHMMSSZ.dump.age
```

Lihat [panduan Oracle Cloud](docs/deployment-oracle-cloud.md), [arsitektur](docs/architecture.md), [catatan pengembangan berikutnya](docs/next-steps.md), dan [riwayat perubahan](CHANGELOG.md).

## Data dan privasi

Riwayat chat dan memori berada di database PostgreSQL pada volume Docker. Teks pesan dan pertanyaan embeddings dikirim ke 9Router; model chat dan embedding yang dipilih dapat meneruskan data ke provider AI terkait. Jangan menyimpan rahasia yang tidak ingin dikirim ke layanan tersebut. Hapus memori dari sidebar atau percakapan lewat tombol hapus. Instalasi ini dirancang untuk satu pengguna, bukan multi-tenant.

## Pemeriksaan

Jalankan tes konfigurasi setelah Python tersedia dan `pip install -r requirements-dev.txt`: `python -m pytest -q`. Periksa konfigurasi Compose: `docker compose config`. Buat image untuk ARM64: `docker buildx build --platform linux/arm64 -t personal-ai:arm64 .`. Lihat status dan log dengan `docker compose ps` dan `docker compose logs app db ninerouter`.

