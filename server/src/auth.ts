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
 */
export const auth = new Elysia({ name: "auth" }).resolve(
  { as: "scoped" },
  ({ headers }) => {
    const penggunaId = headers["x-user-id"];
    if (!penggunaId) {
      return status(401, {
        pesan: "Kamu belum masuk. Masuk dulu untuk melanjutkan.",
      });
    }
    return { penggunaId };
  },
);
