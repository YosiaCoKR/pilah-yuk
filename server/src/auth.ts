import { Elysia, status } from "elysia";

/**
 * Identitas pemanggil.
 *
 * `resolve` (bukan `derive`) karena ia boleh MENGEMBALIKAN status untuk
 * memotong request — melempar status dari derive akan jatuh ke penangan
 * error umum dan keluar sebagai 500.
 *
 * SEMENTARA: dibaca dari header `x-user-id`. Verifikasi JWT Supabase Auth
 * dipasang di task "Daftar & Masuk Akun" (Fase 4) — bentuk context-nya
 * (`penggunaId`) sengaja sudah final supaya route tidak perlu diubah lagi.
 *
 * Sampai saat itu, jalur header ini GAGAL TERTUTUP: tanpa `AUTH_DEV_HEADER=1`
 * (atau NODE_ENV=test) header diabaikan dan semua request dijawab 401. Tanpa
 * pagar itu, API yang ter-deploy sebelum Fase 4 bisa diaku siapa saja hanya
 * dengan menebak satu header — satu baris curl sudah cukup untuk membaca
 * alamat dan nomor HP warga mana pun.
 */
const bolehHeaderPengembangan = () =>
  process.env.AUTH_DEV_HEADER === "1" || process.env.NODE_ENV === "test";

/* Jawaban yang sama untuk "belum masuk" dan "jalur header dimatikan" —
   keadaan konfigurasi server bukan urusan pemanggil. */
const BELUM_MASUK = {
  pesan: "Kamu belum masuk. Masuk dulu untuk melanjutkan.",
};

export const auth = new Elysia({ name: "auth" }).resolve(
  { as: "scoped" },
  ({ headers }) => {
    if (!bolehHeaderPengembangan()) return status(401, BELUM_MASUK);

    const penggunaId = headers["x-user-id"];
    if (!penggunaId) return status(401, BELUM_MASUK);

    return { penggunaId };
  },
);
