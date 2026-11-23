import { eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import {
  GALAT_HP_TERDAFTAR,
  GalatAkun,
  POLA_HP,
  normalkanHp,
  type PenyediaAkun,
} from "../akun";
import { buatPembatas } from "../batas";
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

/* Isian daftar dikirim ULANG bersama kode: sandi baru dipasang setelah
   nomornya terbukti — lihat `PenyediaAkun.kirimKode`. */
const BadanVerifikasi = t.Composite([
  BadanDaftar,
  t.Object({ kode: t.String({ maxLength: 10 }) }),
]);

const BadanLupa = t.Object({ hp: t.String({ maxLength: 20 }) });
const BadanAturUlang = t.Object({
  hp: t.String({ maxLength: 20 }),
  kode: t.String({ maxLength: 10 }),
  sandi: t.String({ maxLength: 72 }),
});

/* Sama untuk nomor terdaftar maupun tidak — layar lupa sandi bukan alat
   untuk menebak nomor siapa yang punya akun. */
const KODE_MUNGKIN_DIKIRIM = {
  pesan: "Kalau nomor ini terdaftar, kode 6 angka sudah dikirim lewat SMS.",
};

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

const LIMA_BELAS_MENIT = 15 * 60_000;
const GALAT_FORMAT_HP = {
  pesan: "Ada isian yang belum benar.",
  rincian: [
    { kolom: "hp", pesan: "Pakai nomor HP Indonesia, mis. 0812 3456 7890." },
  ],
};
const KEBANYAKAN = {
  pesan: "Terlalu banyak percobaan untuk nomor ini. Coba lagi 15 menit lagi.",
};

export const ruteAkun = (
  db: Db,
  penyedia?: PenyediaAkun,
  /* Per nomor HP: 5 tebakan sandi / kode SMS per 15 menit. Kode 6 angka
     punya sejuta kemungkinan; tanpa batas, ia tertebak dalam hitungan jam. */
  batas = buatPembatas(5, LIMA_BELAS_MENIT),
  /* Per nomor HP: 3 SMS per jam — tiap SMS ada biayanya, dan tanpa ini
     satu nomor bisa dibanjiri kode yang tidak pernah ia minta. */
  batasSms = buatPembatas(3, 4 * LIMA_BELAS_MENIT),
) =>
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

        /* Profil hanya ada untuk nomor yang sudah terverifikasi, jadi ini
           cara memeriksa "sudah terdaftar" tanpa bertanya ke Supabase. */
        const [ada] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, hp));
        if (ada) return status(409, { pesan: GALAT_HP_TERDAFTAR });

        if (!batasSms.boleh(`sms:${hp}`)) return status(429, KEBANYAKAN);
        const h = await lewat(() => penyedia.kirimKode(hp));
        if (!h.ok) return h.jawab;
        /* Belum ada sesi: akunnya aktif setelah kode SMS diverifikasi. */
        return status(202, {
          data: { hp },
          pesan: "Kode 6 angka sudah dikirim lewat SMS.",
        });
      },
      { body: BadanDaftar },
    )

    .post(
      "/daftar/verifikasi",
      async ({ body }) => {
        const nama = body.nama.trim();
        const hp = normalkanHp(body.hp);
        const kode = body.kode.replace(/\s/g, "");
        const rincian = periksa(nama, hp, body.sandi);
        if (!/^\d{6}$/.test(kode))
          rincian.push({
            kolom: "kode",
            pesan: "Kodenya 6 angka, tanpa huruf.",
          });
        if (rincian.length)
          return status(422, { pesan: "Ada isian yang belum benar.", rincian });
        if (!penyedia) return status(503, TUTUP);

        if (!batas.boleh(`kode:${hp}`)) return status(429, KEBANYAKAN);
        const h = await lewat(() =>
          penyedia.verifikasi(hp, kode, {
            sandi: body.sandi,
            nama,
            peran: body.peran,
          }),
        );
        if (!h.ok) return h.jawab;
        batas.lupakan(`kode:${hp}`);

        /* Trigger membuat profil saat nomor terkonfirmasi — sebelum nama dan
           peran terpasang — jadi keduanya diisi di sini. */
        const [pengguna] = await db
          .update(users)
          .set({ fullName: nama, role: body.peran })
          .where(eq(users.id, h.nilai.penggunaId))
          .returning({ id: users.id, nama: users.fullName, peran: users.role });
        if (!pengguna)
          throw new Error(
            "Profil tidak terbentuk — trigger auth.users terpasang?",
          );
        return status(201, { data: { pengguna, sesi: h.nilai.sesi } });
      },
      { body: BadanVerifikasi },
    )

    .post(
      "/masuk",
      async ({ body }) => {
        if (!penyedia) return status(503, TUTUP);
        const hp = normalkanHp(body.hp);
        /* Format diperiksa sebelum pembatas, supaya isian sampah tidak
           menjadi kunci baru di peta pembatas. */
        if (!POLA_HP.test(hp)) return status(422, GALAT_FORMAT_HP);
        if (!batas.boleh(`masuk:${hp}`)) return status(429, KEBANYAKAN);
        const h = await lewat(() => penyedia.masuk(hp, body.sandi));
        if (!h.ok) return h.jawab;
        batas.lupakan(`masuk:${hp}`);
        return {
          data: {
            pengguna: await profil(db, h.nilai.penggunaId),
            sesi: h.nilai.sesi,
          },
        };
      },
      { body: BadanMasuk },
    )

    .post(
      "/lupa-sandi",
      async ({ body }) => {
        const hp = normalkanHp(body.hp);
        if (!POLA_HP.test(hp))
          return status(422, {
            pesan: "Ada isian yang belum benar.",
            rincian: [
              {
                kolom: "hp",
                pesan: "Pakai nomor HP Indonesia, mis. 0812 3456 7890.",
              },
            ],
          });
        if (!penyedia) return status(503, TUTUP);
        /* Dihitung untuk SEMUA nomor, sebelum tahu terdaftar atau tidak —
         kalau hanya nomor terdaftar yang bisa kena 429, batasnya sendiri
         jadi petunjuk. */
        if (!batasSms.boleh(`sms:${hp}`)) return status(429, KEBANYAKAN);

        /* SMS hanya untuk nomor yang punya profil: nomor acak tidak bisa
         dibanjiri kode, dan pendaftaran yang belum selesai tidak bisa
         diaktifkan lewat jalur ini. */
        const [ada] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, hp));
        if (ada) {
          const h = await lewat(() => penyedia.kirimKode(hp, false));
          /* Kegagalan penyedia tidak diteruskan: jawabannya akan berbeda dari
           nomor tak terdaftar. Warga tinggal menekan "kirim ulang". */
          if (!h.ok)
            console.error(
              "Kode lupa sandi gagal dikirim untuk satu nomor terdaftar.",
            );
        }
        return status(202, KODE_MUNGKIN_DIKIRIM);
      },
      { body: BadanLupa },
    )

    .post(
      "/lupa-sandi/atur-ulang",
      async ({ body }) => {
        const hp = normalkanHp(body.hp);
        const kode = body.kode.replace(/\s/g, "");
        const rincian: Rincian = [];
        if (!POLA_HP.test(hp)) rincian.push(GALAT_FORMAT_HP.rincian[0]);
        if (!/^\d{6}$/.test(kode))
          rincian.push({
            kolom: "kode",
            pesan: "Kodenya 6 angka, tanpa huruf.",
          });
        if (body.sandi.length < 8)
          rincian.push({
            kolom: "sandi",
            pesan: "Minimal 8 karakter biar tidak mudah ditebak.",
          });
        if (rincian.length)
          return status(422, { pesan: "Ada isian yang belum benar.", rincian });
        if (!penyedia) return status(503, TUTUP);

        if (!batas.boleh(`kode:${hp}`)) return status(429, KEBANYAKAN);
        const h = await lewat(() =>
          penyedia.aturUlangSandi(hp, kode, body.sandi),
        );
        if (!h.ok) return h.jawab;
        batas.lupakan(`kode:${hp}`);
        /* Sandi lama yang mungkin sedang ditebak orang sudah tidak berlaku. */
        batas.lupakan(`masuk:${hp}`);
        return { pesan: "Sandi baru tersimpan. Masuk pakai sandi barumu." };
      },
      { body: BadanAturUlang },
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
