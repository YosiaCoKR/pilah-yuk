import { eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { users } from "../db/schema";

const pilihan = {
  id: users.id,
  fullName: users.fullName,
  phone: users.phone,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
};

/*
  Nomor HP dan email sengaja TIDAK bisa diubah di sini: keduanya identitas
  akun, disalin dari Supabase Auth oleh trigger saat terverifikasi (migrasi
  0012/0013). Menulisnya langsung berarti (1) profil dan akun masuk tidak
  sinkron, dan (2) warga bisa "mengklaim" email/nomor orang lain tanpa
  verifikasi — kolomnya unik, jadi verifikasi pemilik aslinya ikut gagal.
  Ganti kontak harus lewat alur terverifikasi penyedia akun.
*/
const BadanProfil = t.Object({
  fullName: t.String({ minLength: 3, maxLength: 80 }),
});

export const ruteProfil = (db: Db) =>
  new Elysia({ prefix: "/profil" })
    .use(auth)

    .get("/", async ({ penggunaId }) => {
      const [p] = await db
        .select(pilihan)
        .from(users)
        .where(eq(users.id, penggunaId));
      if (!p) return status(404, { pesan: "Profil tidak ditemukan." });
      return { data: p };
    })

    .patch(
      "/",
      async ({ penggunaId, body }) => {
        const [p] = await db
          .update(users)
          .set({ fullName: body.fullName.trim() })
          .where(eq(users.id, penggunaId))
          .returning(pilihan);
        if (!p) return status(404, { pesan: "Profil tidak ditemukan." });
        return { data: p };
      },
      { body: BadanProfil },
    );
