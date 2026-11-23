/**
 * Pendaftaran akun: dari isian warga sampai profil di `users`.
 *
 * Penyedia tiruan menulis ke `auth.users`, jadi baris profil yang dicek di
 * sini dibuat oleh trigger migrasi 0012 — jalur yang sama dengan produksi.
 *
 * Jalankan: npm run test:akun
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { GalatAkun, buatSupabaseAuth } from "../akun";
import { buatApp } from "../app";
import { lulus, siapkan } from "../test/bantu";

const { db, panggil, schema, akun } = await siapkan();
const sah = {
  nama: " Siti ",
  hp: "+62 813-1111-2222",
  sandi: "rahasia123",
  peran: "pengurus",
};

/* --- berhasil: profil terbentuk, peran terbawa, sesi langsung ada --- */
let r = await panggil("POST", "/api/akun/daftar", { body: sah });
assert.equal(r.status, 201, JSON.stringify(r.body));
assert.equal(r.body.data.pengguna.nama, "Siti");
assert.equal(r.body.data.pengguna.peran, "pengurus");
assert.ok(
  r.body.data.sesi.accessToken,
  "warga langsung masuk tanpa layar login",
);
const [profil] = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.id, r.body.data.pengguna.id));
assert.equal(profil.phone, "081311112222", "nomor tersimpan dalam bentuk 08xx");
lulus("POST /akun/daftar → 201, profil + peran + sesi");

/* --- nomor yang sama, ditulis lain --- */
r = await panggil("POST", "/api/akun/daftar", {
  body: { ...sah, hp: "0813 1111 2222", peran: "warga" },
});
assert.equal(r.status, 409);
assert.match(r.body.pesan, /sudah terdaftar/);
lulus("nomor terdaftar (format lain) → 409 dengan arahan masuk");

/* --- isian salah: semua kolom dilaporkan sekaligus, dalam bahasa awam --- */
r = await panggil("POST", "/api/akun/daftar", {
  body: { nama: " Si ", hp: "0212345678", sandi: "pendek", peran: "warga" },
});
assert.equal(r.status, 422);
assert.deepEqual(
  r.body.rincian.map((x: { kolom: string }) => x.kolom),
  ["nama", "hp", "sandi"],
);
lulus("isian salah → 422 per kolom");

r = await panggil("POST", "/api/akun/daftar", {
  body: { ...sah, peran: "admin" },
});
assert.equal(r.status, 422, "peran di luar warga/pengurus ditolak");
lulus("peran asing → 422");

/* --- penyedia: belum disetel, atau menolak --- */
async function daftarLewat(app: ReturnType<typeof buatApp>) {
  const res = await app.handle(
    new Request("http://local/api/akun/daftar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sah, hp: "0857 0000 1111" }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

r = await daftarLewat(buatApp(db));
assert.equal(
  r.status,
  503,
  "tanpa kredensial Supabase: tolak, jangan pura-pura",
);
lulus("tanpa penyedia akun → 503");

r = await daftarLewat(
  buatApp(db, undefined, undefined, {
    ...akun,
    daftar: async () => {
      throw new GalatAkun("Layanan akun sedang tidak bisa dihubungi.", 502);
    },
  }),
);
assert.equal(r.status, 502);
assert.match(r.body.pesan, /tidak bisa dihubungi/);
lulus("penyedia gagal → 502 dengan pesan awam");

/* --- masuk: nomor apa pun formatnya, satu pesan untuk semua kegagalan --- */
r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: "0813-1111-2222", sandi: "rahasia123" },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal(r.body.data.pengguna.nama, "Siti");
assert.equal(r.body.data.pengguna.peran, "pengurus");
assert.ok(r.body.data.sesi.accessToken);
lulus("POST /akun/masuk → profil + sesi");

const salahSandi = await panggil("POST", "/api/akun/masuk", {
  body: { hp: "081311112222", sandi: "salahsalah" },
});
const tanpaAkun = await panggil("POST", "/api/akun/masuk", {
  body: { hp: "089900000000", sandi: "rahasia123" },
});
assert.equal(salahSandi.status, 401);
assert.equal(tanpaAkun.status, 401);
/* Jawaban yang sama persis: layar masuk tidak boleh jadi alat menebak nomor. */
assert.deepEqual(salahSandi.body, tanpaAkun.body);
lulus("sandi salah = nomor tak terdaftar → 401 dengan pesan yang sama");

/* --- keluar --- */
const keluar = (authorization?: string) =>
  panggil("POST", "/api/akun/keluar", {
    kepala: authorization ? { authorization } : {},
  });
r = await keluar("Bearer token-siti");
assert.equal(r.status, 204);
assert.deepEqual(akun.dicabut, ["token-siti"], "sesi dicabut di Supabase");
r = await keluar();
assert.equal(r.status, 204, "tanpa sesi pun keluar tetap berhasil");
assert.equal(akun.dicabut.length, 1, "tanpa token tidak ada yang dicabut");
lulus("POST /akun/keluar → 204, refresh token dicabut");

/* --- klien GoTrue: bentuk permintaan & arti jawabannya (fetch distub) --- */
const asli = globalThis.fetch;
const terkirim: { url: string; badan: Record<string, unknown> }[] = [];
let jawab: (url: string) => [number, object];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  terkirim.push({ url, badan: JSON.parse(String(init.body)) });
  const [kode, isi] = jawab(url);
  return new Response(JSON.stringify(isi), { status: kode });
}) as typeof fetch;
try {
  const supa = buatSupabaseAuth("https://x.supabase.co", "kunci");
  const minta = {
    hp: "081311112222",
    sandi: "rahasia123",
    nama: "Siti",
    peran: "warga" as const,
  };

  jawab = (url) =>
    url.includes("/admin/users")
      ? [200, { id: "u1" }]
      : [
          200,
          {
            access_token: "a",
            refresh_token: "r",
            expires_in: 60,
            user: { id: "u1" },
          },
        ];
  const hasil = await supa.daftar(minta);
  assert.deepEqual(hasil, {
    penggunaId: "u1",
    sesi: { accessToken: "a", refreshToken: "r", expiresIn: 60 },
  });
  assert.equal(terkirim[0].url, "https://x.supabase.co/auth/v1/admin/users");
  assert.equal(
    terkirim[0].badan.phone,
    "6281311112222",
    "Supabase menyimpan 62xx",
  );
  assert.deepEqual(terkirim[0].badan.user_metadata, {
    full_name: "Siti",
    role: "warga",
  });
  assert.match(terkirim[1].url, /token\?grant_type=password$/);

  jawab = () => [422, { error_code: "phone_exists" }];
  await assert.rejects(supa.daftar(minta), (e: GalatAkun) => e.status === 409);

  /* Akun jadi tapi token gagal: jangan suruh daftar ulang (akan 409). */
  jawab = (url) =>
    url.includes("/admin/users") ? [200, { id: "u1" }] : [500, {}];
  await assert.rejects(
    supa.daftar(minta),
    (e: GalatAkun) => e.status === 502 && /sudah jadi/.test(e.pesan),
  );
  lulus("klien GoTrue: 62xx, metadata peran, phone_exists → 409");

  jawab = () => [400, { error_code: "invalid_credentials" }];
  await assert.rejects(
    supa.masuk("081311112222", "salah"),
    (e: GalatAkun) => e.status === 401,
  );

  terkirim.length = 0;
  jawab = () => [401, {}];
  await supa.keluar("token-basi"); // token kedaluwarsa = sudah keluar
  assert.match(
    terkirim[0].url,
    /\/logout\?scope=local$/,
    "cabut sesi ini saja, bukan semua perangkat",
  );
  jawab = () => [500, {}];
  await assert.rejects(supa.keluar("t"), (e: GalatAkun) => e.status === 502);
  lulus("klien GoTrue: sandi salah → 401, token basi tetap dianggap keluar");
} finally {
  globalThis.fetch = asli;
}

console.log("\nSemua pemeriksaan API akun lulus.");
