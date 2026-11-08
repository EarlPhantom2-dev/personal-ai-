# Deploy ke Oracle Cloud Always Free

Panduan ini menargetkan Ubuntu 24.04 ARM64 pada `VM.Standard.A1.Flex`, 2 OCPU dan 12 GB RAM. OCI mencantumkan alokasi ini sebagai batas Always Free Ampere A1 dan menyediakan image Ubuntu 24.04 ARM; kapasitas host di region tertentu dapat sementara tidak tersedia ([Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [daftar image Ubuntu ARM](https://docs.oracle.com/en-us/iaas/Content/Compute/References/images.htm)).

## 1. Buat instance dan batasi jaringan

Di OCI Console, pilih image Ubuntu 24.04 **aarch64**, shape `VM.Standard.A1.Flex`, 2 OCPU, 12 GB RAM, lalu tambahkan public IP. Periksa label **Always Free-eligible** sebelum membuat instance.

Di Network Security Group atau Security List, izinkan ingress:

- TCP 22 hanya dari alamat IP admin Anda.
- TCP 80 dan 443 untuk HTTPS.
- Jangan buka port 5432 (PostgreSQL), 8000 (FastAPI), atau 20128 (dashboard 9Router) ke internet.

## 2. Siapkan Ubuntu

Masuk melalui SSH, perbarui paket, lalu pasang Docker Engine dan Compose plugin dari dokumentasi resmi Docker:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git openssl age
```

Ikuti [langkah instalasi Docker Engine untuk Ubuntu](https://docs.docker.com/engine/install/ubuntu/) dan pilih `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, serta `docker-compose-plugin`. Docker mendukung Ubuntu ARM64.

Opsional: aktifkan firewall host setelah memastikan SSH tetap diizinkan:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from ADMIN_PUBLIC_IP to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Ganti `ADMIN_PUBLIC_IP` dengan IP publik admin `/32`. Atur juga ingress di OCI; aturan firewall host tidak menggantikan aturan jaringan OCI.

## 3. Pasang proyek dan rahasia

```bash
git clone https://github.com/EarlPhantom2-dev/personal-ai-.git
cd personal-ai-
cp .env.example .env
bash scripts/start-9router-bootstrap.sh
```

Siapkan DNS `A` record domain ke public IP. Atur `DOMAIN=ai.domain-anda` dalam `.env`. Jangan menaruh `.secrets/` atau `.env` di Git. Dashboard 9Router dibind ke loopback; akses lewat tunnel SSH dari komputer admin:

```bash
ssh -L 20128:127.0.0.1:20128 ubuntu@PUBLIC_IP
```

Buka `http://127.0.0.1:20128`, masuk dengan kata sandi awal `123456`, lalu segera ganti. Sambungkan provider AI, salin API key, dan pilih model chat serta model embedding. Hapus container bootstrap setelah selesai:

```bash
docker rm -f personal-ai-ninerouter-bootstrap
```

Data dashboard tersimpan di volume `personal-ai-ninerouter_data`. Jalankan `bash scripts/init-secrets.sh` dan masukkan API key serta model saat diminta; script membuat secret aplikasi dan menuliskan model serta public recipient backup ke `.env`. Aplikasi memakai endpoint internal `http://ninerouter:20128/v1`.

## 4. Jalankan layanan

```bash
docker compose --profile tls --profile backup up -d --build
docker compose ps
docker compose logs --tail=100 app db ninerouter caddy backup
```

Compose membatasi bind aplikasi dan 9Router ke localhost; Caddy menerbitkan TLS untuk `DOMAIN`. Pastikan A record sudah tersebar dan TCP 80/443 masuk sebelum menjalankan Caddy. Buka `https://ai.domain-anda`, masuk menggunakan kata sandi yang dibuat.

Health checks: `http://127.0.0.1:8000/health/live` (live) dan `/health/ready` (PostgreSQL siap). Setelah startup pertama, verifikasi login, satu balasan chat, dan memori baru dari browser.

## 5. Operasi rutin

- Perbarui source setelah meninjau release dan perubahan skema. `docker compose pull && docker compose up -d --build` memperbarui image yang dipin dalam Compose; tinjau serta ubah tag 9Router secara eksplisit ketika akan memperbarui.
- Backup harian disimpan sebagai `backups/personal-ai-*.dump.age` dan retensinya dikendalikan `BACKUP_RETENTION_DAYS`.
- Salin backup terenkripsi ke penyimpanan di luar VM. Simpan `.secrets/backup_age_key` di luar VM lewat kanal terpisah; tanpa kunci privat ini restore tidak bisa dilakukan.
- Pemulihan database: `bash scripts/restore.sh backups/nama-file.dump.age`. Perintah ini mengganti database aktif dan meminta Anda mengetik `RESTORE`.
- Pantau ruang disk (`df -h`), kapasitas volume PostgreSQL, dan hasil backup. HNSW belum dibuat; pencarian vektor menggunakan exact scan, sesuai koleksi memori pribadi berukuran kecil.

## Batas dan catatan keamanan

Instalasi ini satu pengguna. Caddy memberikan TLS; backend dan dashboard router tidak dipublikasikan. Chat dan teks embeddings diproses oleh 9Router lalu provider AI yang dipilih, jadi periksa kebijakan provider sebelum menyimpan data sensitif. Backup dienkripsi ke public key `age`; private key harus disimpan terpisah dan pemulihan harus diuji sebelum menyimpan data penting.
