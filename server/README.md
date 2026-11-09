# Pilah Yuk — API

Elysia di atas runtime Bun, Drizzle ORM ke Supabase Postgres.

## Jalankan

```bash
cp .env.example .env     # isi DATABASE_URL dari Supabase
npm install
npm run db:migrate       # terapkan migrasi
npm run db:seed          # kategori sampah, benda panduan pilah, slot jam, paket langganan
npm run dev              # http://localhost:3001
```

## Pemeriksaan

`npm test` menjalankan seluruh pemeriksaan di atas Postgres sementara
(PGlite, in-process) — tidak perlu kredensial Supabase.

| Perintah | Yang diperiksa |
|---|---|
| `npm run db:check` | Migrasi benar-benar jalan; constraint menggigit |
| `npm run test:seed` | Seed data acuan jalan, idempoten, dan panduan pilahnya utuh |
| `npm run test:api` | API alamat, termasuk isolasi antar warga |
| `npm run test:slot` | Slot jam + perhitungan sisa kuota |
| `npm run test:pesanan` | Kirim, daftar, dan batalkan pesanan |
| `npm run test:langganan` | Paket, status, tagihan, kuitansi, gerbang langganan |
| `npm run test:panduan` | Panduan pilah: daftar, detail, pencarian, tips berotasi |

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
| GET | `/api/langganan/paket` | Daftar paket, termurah lebih dulu |
| GET | `/api/langganan/saya` | Status langganan: periode berjalan, sisa kuota, gerbang booking |
| PUT | `/api/langganan/perpanjang-otomatis` | Nyalakan/matikan perpanjangan otomatis |
| POST | `/api/langganan/bayar` | Buat tagihan satu paket (baru / ganti / perpanjang) |
| GET | `/api/langganan/tagihan` | Riwayat pembayaran (lunas & gagal), terbaru dulu |
| GET | `/api/langganan/tagihan/:id` | Satu struk, untuk layar detail |
| GET | `/api/panduan` | Seluruh panduan: tiap jenis + bendanya (ringkas: nama + sorot) |
| GET | `/api/panduan/cari?kata=` | Cari benda panduan pilah; nama kategori ikut dicocokkan |
| GET | `/api/panduan/tips?tanggal=` | Tip pilah hari itu; berotasi per tanggal, sama untuk semua warga |
| GET | `/api/panduan/:jenis` | Satu jenis + benda yang sering dikira masuk sini |
| GET | `/api/langganan/tagihan/:id/kuitansi` | Kuitansi `.txt` (lampiran), angka dari basis data |

### Gerbang langganan (booking)

`GET /api/langganan/saya` adalah endpoint cek sebelum menjadwalkan jemput —
tidak ada endpoint cek terpisah, supaya aturannya tidak hidup di dua tempat.
Dua bendera, karena tidak semua yang dijaga memakai kuota hari ini:

| Bendera | Artinya | Dipakai |
|---|---|---|
| `langgananAktif` | Paket berjalan (status `aktif` + tanggal belum lewat). Kuota diabaikan. | Jadwal rutin — berlaku untuk periode berikutnya |
| `bolehPesan` | `langgananAktif` DAN kuota periode ini masih ada | Pesanan sekali jalan |

`alasan` menyebut kenapa `bolehPesan` false (belum bayar / kedaluwarsa / kuota
habis), `null` saat memang boleh. Aturannya ditegakkan lagi di server pada
`POST /api/pesanan` (→ 402) — tombol di layar bisa dilewati.

### Kode status

| Kode | Arti |
|---|---|
| 401 | Belum masuk |
| 402 | Langganan belum aktif atau kuota habis |
| 404 | Tidak ditemukan — termasuk milik warga lain, supaya tidak membocorkan keberadaannya |
| 409 | Bentrok: kuota slot penuh, atau pesanan sudah tidak bisa dibatalkan |
| 422 | Isian tidak sah; `rincian` menyebut kolom yang salah |
