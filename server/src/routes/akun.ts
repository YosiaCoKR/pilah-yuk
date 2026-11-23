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

const BadanMasuk = t.Object({
  hp: t.String({ maxLength: 20 }),
  sandi: t.String({ maxLength: 72 }),
});

type Rincian = { kolom: string; pesan: string }[];

const TUTUP = {
  pesan: "Layanan akun sedang ditutup sementara. Coba lagi nanti.",
};

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

/** Profil yang dikirim ke frontend setelah daftar/masuk. */
async function profil(db: Db, id: string) {
  const [p] = await db
    .select({ id: users.id, nama: users.fullName, peran: users.role })
    .from(users)
    .where(eq(users.id, id));
  /* Profil dibuat trigger auth.users. Kalau tidak ada, migrasinya belum
     terpasang — itu salah server, bukan warga. */
  if (!p)
    throw new Error("Profil tidak terbentuk — trigger auth.users terpasang?");
  return p;
}

/** Jalankan panggilan penyedia; `GalatAkun` jadi jawaban HTTP. */
async function lewat<T>(kerja: () => Promise<T>) {
  try {
    return { ok: true as const, nilai: await kerja() };
  } catch (e) {
    if (e instanceof GalatAkun)
      return {
        ok: false as const,
        jawab: status(e.status, { pesan: e.pesan }),
      };
    throw e;
  }
}

export const ruteAkun = (db: Db, penyedia?: PenyediaAkun) =>
  new Elysia({ prefix: "/akun" })
    .post(
      "/daftar",
      async ({ body }) => {
        const nama = body.nama.trim();
        const hp = normalkanHp(body.hp);
        const rincian = periksa(nama, hp, body.sandi);
        if (rincian.length)
          return status(422, { pesan: "Ada isian yang belum benar.", rincian });

        /* Tanpa kredensial Supabase, tolak terang-terangan — jangan pernah
         jatuh ke akun tiruan di produksi. */
        if (!penyedia) return status(503, TUTUP);

        const h = await lewat(() =>
          penyedia.daftar({ hp, sandi: body.sandi, nama, peran: body.peran }),
        );
        if (!h.ok) return h.jawab;
        return status(201, {
          data: {
            pengguna: await profil(db, h.nilai.penggunaId),
            sesi: h.nilai.sesi,
          },
        });
      },
      { body: BadanDaftar },
    )

    .post(
      "/masuk",
      async ({ body }) => {
        /* Format nomor salah tetap dijawab dengan pesan gabungan yang sama —
         tidak perlu memberi petunjuk apa pun sebelum Supabase menjawab. */
        if (!penyedia) return status(503, TUTUP);
        const h = await lewat(() =>
          penyedia.masuk(normalkanHp(body.hp), body.sandi),
        );
        if (!h.ok) return h.jawab;
        return {
          data: {
            pengguna: await profil(db, h.nilai.penggunaId),
            sesi: h.nilai.sesi,
          },
        };
      },
      { body: BadanMasuk },
    )

    /* Mencabut refresh token di Supabase. Tanpa token pun dijawab 204: yang
     diminta warga ("aku sudah keluar") memang sudah benar. */
    .post("/keluar", async ({ headers }) => {
      const token = headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
      if (token) {
        if (!penyedia) return status(503, TUTUP);
        const h = await lewat(() => penyedia.keluar(token));
        if (!h.ok) return h.jawab;
      }
      /* Response eksplisit: handler yang mengembalikan undefined dijawab
       Elysia sebagai 404. */
      return new Response(null, { status: 204 });
    });
