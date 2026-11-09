# Pilah Yuk

> Layanan angkut sampah berbasis channel RT/RW: pesan jemput dari rumah, atur jadwal rutin, bayar langganan, dan belajar memilah — dalam satu aplikasi.

## Deskripsi

Warga sering tidak punya jalur yang jelas untuk membuang sampah selain menunggu
truk lewat, dan ketika sampahnya terlanjur tercampur, tidak ada yang bisa
memilah lagi di hilir. **Pilah Yuk** menghubungkan warga dengan channel RT/RW
terdekat: warga memesan penjemputan dari HP, berlangganan paket bulanan atau
mingguan lewat pembayaran lokal (QRIS, e-wallet, VA bank), dan dibantu panduan
pilah yang menjawab satu pertanyaan konkret — "benda ini masuk tong mana?".

Repo ini berisi dua bagian: aplikasi web Next.js (`src/`) dan API Elysia +
Drizzle di atas Supabase Postgres (`server/`).

## Status pengembangan

Proyek masih dibangun lapis demi lapis, jadi penting diketahui sebelum
menjalankannya:

| Bagian | Keadaan |
|---|---|
| Frontend (`src/`) | **Semua layar berjalan di atas data tiruan** (`src/lib/mock.ts` + `src/lib/toko-*.ts`). Belum ada satu pun panggilan ke API. |
| Backend (`server/`) | Jalan dan teruji: 18 tabel, 12 migrasi, ~324 pemeriksaan otomatis. |
| Autentikasi | **Sementara** lewat header `x-user-id`, hanya terbuka kalau `AUTH_DEV_HEADER=1`. Verifikasi JWT Supabase Auth belum dipasang. |
| Pembayaran | Midtrans Core API; tanpa `MIDTRANS_SERVER_KEY` endpoint bayar gagal tertutup (503), tidak meninggalkan tagihan menggantung. |

Artinya `npm run dev` menampilkan aplikasi utuh yang bisa diklik-klik tanpa
perlu database sama sekali — penyambungan frontend ke API adalah pekerjaan
berikutnya.

## Daftar isi

- [Fitur](#fitur)
- [Tech stack](#tech-stack)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Menjalankan](#menjalankan)
- [API](#api)
- [Struktur proyek](#struktur-proyek)
- [Pemeriksaan](#pemeriksaan)
- [Lisensi](#lisensi)

## Fitur

- **Pesan jemput sekali jalan** — pilih alamat, jenis sampah, tanggal, dan slot
  jam; kuota tiap slot dihitung dari pesanan yang sudah masuk hari itu
  (`src/app/pesan/`, `server/src/routes/pesanan.ts`, `slot-waktu.ts`).
- **Jadwal rutin** — jadwal mingguan per hari + slot jam, bisa dijeda sementara
  dan punya sakelar pengingat sendiri (`src/app/jadwal/`,
  `server/src/routes/jadwal.ts`).
- **Langganan & pembayaran** — paket mingguan/bulanan dengan kuota jemput,
  tagihan lewat QRIS / e-wallet / VA bank, perpanjangan lebih awal yang
  menyambung dari tanggal berakhir (bukan menghanguskan sisa hari), dan
  perpanjangan otomatis (`server/src/routes/langganan.ts`, `pembayaran.ts`).
- **Riwayat tagihan & kuitansi** — struk per pembayaran plus kuitansi `.txt`
  yang angkanya dirakit dari basis data, siap dikirim ke pengurus RW lewat
  WhatsApp (`server/src/routes/langganan.ts`).
- **Channel RT/RW** — keanggotaan, pengumuman, jadwal angkut channel, dan papan
  diskusi berutas (`src/app/(utama)/channel/`, `server/src/routes/channel.ts`).
- **Riwayat penjemputan & bukti** — rincian timbangan, petugas, dan tanda terima
  teks per pengangkutan yang sudah selesai (`src/app/(utama)/riwayat/`,
  `server/src/routes/riwayat.ts`).
- **Panduan pilah sampah** — cari benda ("styrofoam", "kulit telur") dan
  langsung dapat tong tujuannya, termasuk benda yang *sering dikira* masuk tong
  lain (`src/app/(utama)/panduan/`, tabel `waste_guide_items`).
- **Gerbang langganan** — aturan "boleh memesan atau tidak" hidup di satu
  tempat dan ditegakkan ulang di server (402), bukan hanya dengan menonaktifkan
  tombol (`server/src/langganan.ts`).

## Tech stack

| Kategori | Teknologi |
|---|---|
| Frontend | Next.js 16.4.3 (App Router, `cacheComponents`) · React 19.3.0 · Tailwind CSS 4.3.3 |
| Backend | Elysia 1.4 di atas runtime Bun |
| Database | Supabase PostgreSQL · Drizzle ORM 0.44 · drizzle-kit 0.31 |
| Driver | `postgres` 3.4 (postgres-js) |
| Pembayaran | Midtrans Core API (QRIS, e-wallet, VA bank) + webhook |
| Pemeriksaan | PGlite 0.5 (Postgres in-process) · `node:assert` · tsx |
| Bahasa | TypeScript 5.9 (`strict`) |

Tidak ada framework test, state manager, atau component library tambahan —
komponen UI dan store sesi ditulis sendiri di `src/components/` dan
`src/lib/toko-*.ts`.

## Prasyarat

- **Node.js >= 20.9** (syarat Next.js 16.4.3; dikembangkan di Node 24.21)
- **Bun** — hanya untuk menjalankan API (`server`); frontend dan seluruh
  pemeriksaan jalan di Node
- **Supabase project** atau Postgres lain — hanya kalau mau menjalankan API di
  atas database sungguhan. Pemeriksaan tidak membutuhkannya.
- **Midtrans Sandbox server key** — hanya kalau mau mencoba alur pembayaran

## Instalasi

1. Clone repository

   ```bash
   git clone https://github.com/YosiaCoKR/pilah-yuk.git
   cd pilah-yuk
   ```

2. Install dependency frontend

   ```bash
   npm install
   ```

3. Install dependency API

   ```bash
   cd server && npm install && cd ..
   ```

Sampai di sini frontend sudah bisa dijalankan. Langkah di bawah hanya
diperlukan untuk API:

4. Siapkan environment

   ```bash
   cp server/.env.example server/.env
   # lalu isi DATABASE_URL (lihat tabel Konfigurasi)
   ```

5. Terapkan migrasi dan isi data acuan

   ```bash
   cd server
   npm run db:migrate   # 12 migrasi → 18 tabel
   npm run db:seed      # kategori sampah, benda panduan, slot jam, paket langganan
   ```

## Konfigurasi

Semua environment variable milik API, di `server/.env` (nama saja — nilainya
jangan pernah di-commit). Berkas `server/.env.example` adalah acuannya.

| Variable | Guna | Wajib |
|---|---|---|
| `DATABASE_URL` | Connection string Supabase Postgres. Session pooler (port 5432) untuk migrasi. | ya |
| `SUPABASE_URL` | Project Supabase, dipakai saat verifikasi token Auth masuk | belum |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci service role Supabase | belum |
| `PORT` | Port API | tidak (default `3001`) |
| `AUTH_DEV_HEADER` | `1` membuka identitas lewat header `x-user-id`. **Hanya pengembangan lokal** — siapa pun yang tahu satu id warga bisa mengaku jadi warga itu. | pengembangan |
| `MIDTRANS_SERVER_KEY` | Server key Midtrans Core API (pakai Sandbox dulu) | untuk pembayaran |
| `MIDTRANS_PRODUKSI` | `1` = menagih ke Midtrans produksi (uang sungguhan). Kosong/`0` = sandbox. | tidak |

Frontend belum punya environment variable — belum ada yang dibaca dari
`process.env` di `src/`.

## Menjalankan

**Frontend** (dari root):

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start
npm run lint
```

**API** (dari `server/`):

```bash
npm run dev        # bun --watch, http://localhost:3001
npm run start
npm run db:studio  # Drizzle Studio
```

Cek API hidup:

```bash
curl http://localhost:3001/sehat
# {"status":"ok"}
```

Contoh memanggil endpoint yang butuh identitas (butuh `AUTH_DEV_HEADER=1`):

```bash
curl http://localhost:3001/api/langganan/saya \
  -H "x-user-id: 11111111-1111-1111-1111-111111111111"
```

## API

Semua endpoint di bawah `/api` butuh identitas pemanggil. Daftar lengkap
beserta arti tiap kode status ada di **[`server/README.md`](server/README.md)**.

| Prefix | Isi |
|---|---|
| `/sehat` | Cek server hidup (tanpa identitas) |
| `/api/alamat` | CRUD alamat jemput + penanda alamat utama |
| `/api/slot-waktu` | Slot jam dan sisa kuota per tanggal |
| `/api/pesanan` | Kirim, daftar, dan batalkan permintaan jemput |
| `/api/langganan` | Paket, status + gerbang booking, tagihan, kuitansi, perpanjangan otomatis |
| `/api/jadwal` | Jemput mendatang dan jadwal rutin (ubah, jeda, pengingat) |
| `/api/riwayat` | Pengangkutan yang sudah berakhir + tanda terima teks |
| `/api/channel` | Channel RT/RW: anggota, pengumuman, jadwal, diskusi |
| `/api/webhook` | Notifikasi pembayaran dari Midtrans (bertanda tangan) |

Kode status yang dipakai konsisten di semua rute: `401` belum masuk, `402`
langganan belum aktif atau kuota habis, `404` tidak ditemukan (termasuk milik
warga lain, supaya keberadaannya tidak bocor), `409` bentrok, `422` isian tidak
sah.

## Struktur proyek

```
.
├── src/
│   ├── app/                 # Route App Router (23 halaman)
│   │   ├── (utama)/         # Layar dengan tab bawah: beranda, jadwal,
│   │   │                    # riwayat, langganan, panduan, channel, profil
│   │   ├── pesan/           # Alur pesan jemput (layar penuh)
│   │   └── jadwal/          # Atur & jeda jadwal rutin
│   ├── components/          # Komponen UI, dikelompokkan per fitur
│   └── lib/
│       ├── mock.ts          # Data tiruan — sumber data frontend saat ini
│       ├── toko-*.ts        # Store sesi (useSyncExternalStore)
│       ├── kalimat.ts       # Perakit kalimat & kuitansi
│       └── types.ts         # Bentuk data yang dibaca layar
│
├── server/
│   ├── src/
│   │   ├── app.ts           # Rakitan Elysia + penangan error
│   │   ├── auth.ts          # Identitas pemanggil (sementara: header)
│   │   ├── db/
│   │   │   ├── schema.ts    # 18 tabel + constraint + kebijakan RLS
│   │   │   └── seed.ts      # Data acuan, aman dijalankan berulang
│   │   ├── routes/          # Satu berkas per kelompok endpoint + test-nya
│   │   ├── langganan.ts     # Gerbang langganan & ringkasan status
│   │   └── pembayaran.ts    # Midtrans Core API
│   ├── drizzle/             # 12 migrasi SQL + snapshot
│   └── README.md            # Daftar endpoint lengkap & kode status
│
└── AGENTS.md                # Catatan untuk AI coding agent
```

## Pemeriksaan

Seluruh pemeriksaan backend berjalan di atas Postgres sementara (PGlite,
in-process) dengan migrasi yang **sama** dengan produksi — jadi tidak perlu
kredensial Supabase sama sekali.

```bash
cd server && npm test     # ~324 pemeriksaan
```

Beberapa yang bisa dijalankan sendiri:

| Perintah | Yang diperiksa |
|---|---|
| `npm run db:check` | Migrasi benar-benar jalan; constraint menggigit |
| `npm run test:langganan` | Paket, status, tagihan, kuitansi, gerbang booking |
| `npm run test:bayar` / `test:webhook` | Midtrans Core API + webhook idempoten |
| `npm run test:rls` | Kebijakan RLS: warga tidak bisa membaca milik orang lain |
| `npm run test:channel` | Channel RT/RW: anggota, pengumuman, diskusi |

Frontend (dari root):

```bash
npm run test:kalimat      # perakit kalimat & kuitansi
npm run lint
```

## Lisensi

<!-- TODO: belum ada berkas LICENSE di repo. Tentukan lisensinya (mis. MIT)
     lalu tambahkan LICENSE dan perbarui bagian ini. -->

Belum ditentukan.

## Penulis

**Yosia Sipahutar** — [@YosiaCoKR](https://github.com/YosiaCoKR)
