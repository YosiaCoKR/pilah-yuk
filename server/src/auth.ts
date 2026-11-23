import { Elysia, status } from "elysia";
import { GALAT_SESI_HABIS, GalatAkun } from "./akun";

/**
 * Identitas pemanggil.
 *
 * `resolve` (bukan `derive`) karena ia boleh MENGEMBALIKAN status untuk
 * memotong request — melempar status dari derive akan jatuh ke penangan
 * error umum dan keluar sebagai 500.
 *
 * Jalur utama: `Authorization: Bearer <access token>` dari /api/akun/masuk,
 * ditanyakan ke Supabase lewat `kenaliToken` yang dipasang `buatApp`
 * (decorator — route cukup `.use(auth)` tanpa tahu penyedianya).
 *
 * Jalur pengembangan: header `x-user-id`, HANYA bila `AUTH_DEV_HEADER=1`
 * (atau NODE_ENV=test). Di luar itu ia diabaikan — tanpa pagar ini siapa pun
 * bisa mengaku warga mana pun hanya dengan menebak satu header.
 *
 * Tidak ada pemeriksaan `users.role` di sini: peran itu dipilih sendiri saat
 * mendaftar, jadi bukan bukti wewenang. Wewenang pengurus dibaca dari
 * `channel_members.is_pengurus` per channel (lihat routes/channel.ts).
 */
const bolehHeaderPengembangan = () =>
  process.env.AUTH_DEV_HEADER === "1" || process.env.NODE_ENV === "test";

/* Jawaban yang sama untuk "belum masuk" dan "jalur header dimatikan" —
   keadaan konfigurasi server bukan urusan pemanggil. */
const BELUM_MASUK = {
  pesan: "Kamu belum masuk. Masuk dulu untuk melanjutkan.",
};

type Konteks = {
  headers: Record<string, string | undefined>;
  kenaliToken?: (token: string) => Promise<string | null>;
};

export const auth = new Elysia({ name: "auth" }).resolve(
  { as: "scoped" },
  async (ctx) => {
    const { headers, kenaliToken } = ctx as unknown as Konteks;

    const token = headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (token) {
      if (!kenaliToken) return status(401, BELUM_MASUK);
      try {
        const penggunaId = await kenaliToken(token);
        if (!penggunaId) return status(401, { pesan: GALAT_SESI_HABIS });
        return { penggunaId };
      } catch (e) {
        if (e instanceof GalatAkun) return status(e.status, { pesan: e.pesan });
        throw e;
      }
    }

    if (!bolehHeaderPengembangan()) return status(401, BELUM_MASUK);
    const penggunaId = headers["x-user-id"];
    if (!penggunaId) return status(401, BELUM_MASUK);
    return { penggunaId };
  },
);
