import { eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { GalatAkun, POLA_HP, normalkanHp, type PenyediaAkun } from "../akun";
import type { Db } from "../db";
import { users } from "../db/schema";

const BadanDaftar = t.Object({
  nama: t.String({ maxLength: 80 }),
  hp: t.String({ maxLength: 20 }),
  sandi: t.String({ maxLength: 72 }),
  peran: t.Union([t.Literal("warga"), t.Literal("pengurus")], {
    error: "Pilih daftar sebagai warga atau pengurus RT/RW.",
  }),
});

type Rincian = { kolom: string; pesan: string }[];

/**
 * Aturan yang sama dengan `periksaPendaftaran` di frontend, kalimatnya juga.
 * Frontend memeriksa lebih dulu; ini pagar untuk klien yang melewatinya.
 */
function periksa(nama: string, hp: string, sandi: string): Rincian {
  const r: Rincian = [];
  if (nama.length < 3)
    r.push({
      kolom: "nama",
      pesan: "Namanya terlalu singkat — minimal 3 huruf.",
    });
  if (!POLA_HP.test(hp))
    r.push({
      kolom: "hp",
      pesan: "Pakai nomor HP Indonesia, mis. 0812 3456 7890.",
    });
  if (sandi.length < 8)
    r.push({
      kolom: "sandi",
      pesan: "Minimal 8 karakter biar tidak mudah ditebak.",
    });
  return r;
}

export const ruteAkun = (db: Db, penyedia?: PenyediaAkun) =>
  new Elysia({ prefix: "/akun" }).post(
    "/daftar",
    async ({ body }) => {
      const nama = body.nama.trim();
      const hp = normalkanHp(body.hp);
      const rincian = periksa(nama, hp, body.sandi);
      if (rincian.length)
        return status(422, { pesan: "Ada isian yang belum benar.", rincian });

      /* Tanpa kredensial Supabase, tolak terang-terangan — jangan pernah
         jatuh ke akun tiruan di produksi. */
      if (!penyedia)
        return status(503, {
          pesan: "Pendaftaran sedang ditutup sementara. Coba lagi nanti.",
        });

      let hasil;
      try {
        hasil = await penyedia.daftar({
          hp,
          sandi: body.sandi,
          nama,
          peran: body.peran,
        });
      } catch (e) {
        if (e instanceof GalatAkun) return status(e.status, { pesan: e.pesan });
        throw e;
      }

      /* Profil dibuat trigger auth.users di transaksi yang sama. Kalau tidak
         ada, migrasi 0012 belum terpasang — itu salah server, bukan warga. */
      const [profil] = await db
        .select({ id: users.id, nama: users.fullName, peran: users.role })
        .from(users)
        .where(eq(users.id, hasil.penggunaId));
      if (!profil)
        throw new Error(
          "Profil tidak terbentuk — trigger migrasi 0012 terpasang?",
        );

      return status(201, { data: { pengguna: profil, sesi: hasil.sesi } });
    },
    { body: BadanDaftar },
  );
