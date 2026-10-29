# Pilah Yuk — API

Elysia di atas runtime Bun, Drizzle ORM ke Supabase Postgres.

## Jalankan

```bash
cp .env.example .env     # isi DATABASE_URL dari Supabase
npm install
npm run db:migrate       # terapkan migrasi
npm run db:seed          # kategori sampah, slot jam, paket langganan
npm run dev              # http://localhost:3001
```

## Pemeriksaan

`npm test` menjalankan seluruh pemeriksaan di atas Postgres sementara
(PGlite, in-process) — tidak perlu kredensial Supabase.

| Perintah | Yang diperiksa |
|---|---|
| `npm run db:check` | Migrasi benar-benar jalan; constraint menggigit |
| `npm run test:api` | API alamat, termasuk isolasi antar warga |
| `npm run test:slot` | Slot jam + perhitungan sisa kuota |
| `npm run test:pesanan` | Kirim, daftar, dan batalkan pesanan |
| `npm run test:langganan` | Gerbang langganan sebelum memesan |

## Endpoint

Semua endpoint butuh identitas pemanggil.

> **Sementara:** identitas dibaca dari header `x-user-id`. Verifikasi JWT
> Supabase Auth dipasang di task "Daftar & Masuk Akun" (Fase 4); bentuk
> context-nya sudah final jadi route tidak perlu diubah.

| Metode | Path | Guna |
|---|---|---|
| GET | `/sehat` | Cek server hidup (tanpa identitas) |
| GET | `/api/alamat` | Daftar alamat jemput; alamat utama di urutan pertama |
| POST | `/api/alamat` | Tambah alamat |
| PATCH | `/api/alamat/:id` | Ubah alamat |
| PUT | `/api/alamat/:id/utama` | Jadikan alamat utama |
| DELETE | `/api/alamat/:id` | Hapus alamat |
| GET | `/api/slot-waktu?tanggal=&channelId=` | Slot jam + sisa kuota hari itu |
| POST | `/api/pesanan` | Kirim permintaan jemput |
| GET | `/api/pesanan` | Riwayat pesanan warga |
| PUT | `/api/pesanan/:id/batal` | Batalkan (hanya saat masih menunggu) |
| GET | `/api/langganan/saya` | Status langganan + sisa kuota |

### Kode status

| Kode | Arti |
|---|---|
| 401 | Belum masuk |
| 402 | Langganan belum aktif atau kuota habis |
| 404 | Tidak ditemukan — termasuk milik warga lain, supaya tidak membocorkan keberadaannya |
| 409 | Bentrok: kuota slot penuh, atau pesanan sudah tidak bisa dibatalkan |
| 422 | Isian tidak sah; `rincian` menyebut kolom yang salah |
