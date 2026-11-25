import { eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { users } from "../db/schema";
import { bentrokDengan } from "../galat";

const pilihan = {
  id: users.id,
  fullName: users.fullName,
  phone: users.phone,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
};

/*
  Nomor HP sengaja TIDAK bisa diubah di sini: ia identitas masuk, disalin dari
  Supabase Auth oleh trigger (migrasi 0012). Mengubahnya hanya di tabel ini
  membuat profil dan akun masuk tidak sinkron. Ganti nomor butuh verifikasi
  SMS lewat penyedia akun — alur sendiri, bukan PATCH profil.
*/
const BadanProfil = t.Object({
  fullName: t.Optional(t.String({ minLength: 3, maxLength: 80 })),
  /* "" atau null = hapus email. */
  email: t.Optional(
    t.Union([
      t.Null(),
      t.Literal(""),
      t.String({ format: "email", maxLength: 254 }),
    ]),
  ),
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
        const email =
          body.email === undefined
            ? undefined
            : body.email?.trim().toLowerCase() || null;
        const ubah = {
          ...(body.fullName !== undefined && {
            fullName: body.fullName.trim(),
          }),
          ...(email !== undefined && { email }),
        };
        if (Object.keys(ubah).length === 0)
          return status(422, { pesan: "Tidak ada yang diubah." });
        try {
          const [p] = await db
            .update(users)
            .set(ubah)
            .where(eq(users.id, penggunaId))
            .returning(pilihan);
          if (!p) return status(404, { pesan: "Profil tidak ditemukan." });
          return { data: p };
        } catch (e) {
          if (bentrokDengan(e, "users_email_idx"))
            return status(409, {
              pesan: "Email ini sudah dipakai akun lain.",
            });
          /* Kontak terakhir tidak boleh hilang: pengingat jemput dikirim ke
             salah satunya. */
          if (bentrokDengan(e, "users_punya_kontak"))
            return status(422, {
              pesan: "Email tidak bisa dihapus selama belum ada nomor HP.",
            });
          throw e;
        }
      },
      { body: BadanProfil },
    );
