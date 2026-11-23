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
import { buatPembatas } from "../batas";
import { pesanValidasi } from "../galat";
import { buatApp } from "../app";
import { KODE_UJI, lulus, siapkan } from "../test/bantu";

const { db, app, panggil, schema, akun } = await siapkan();
const sah = {
  nama: " Siti ",
  hp: "+62 813-1111-2222",
  sandi: "rahasia123",
  peran: "pengurus",
};

/* --- daftar: kode SMS dulu, belum ada sesi maupun profil --- */
let r = await panggil("POST", "/api/akun/daftar", { body: sah });
assert.equal(r.status, 202, JSON.stringify(r.body));
assert.equal(r.body.data.hp, "081311112222");
assert.equal(
  r.body.data.sesi,
  undefined,
  "belum masuk sebelum kode diverifikasi",
);
const belum = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.phone, "081311112222"));
assert.equal(
  belum.length,
  0,
  "nomor belum terbukti miliknya → belum ada profil",
);
lulus("POST /akun/daftar → 202, kode dikirim, profil belum ada");

/* Belum aktif: belum bisa masuk pakai sandinya. */
r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: sah.hp, sandi: sah.sandi },
});
assert.equal(r.status, 401);

r = await panggil("POST", "/api/akun/daftar/verifikasi", {
  body: { ...sah, kode: "000000" },
});
assert.equal(r.status, 422);
assert.match(r.body.pesan, /kedaluwarsa/);
r = await panggil("POST", "/api/akun/daftar/verifikasi", {
  body: { ...sah, kode: "12a456" },
});
assert.equal(r.body.rincian[0].kolom, "kode");
lulus("kode salah → 422, akun tetap belum aktif");

/* Orang lain mendaftarkan nomor yang sama sebelum pemiliknya memasukkan
   kode. Dulu sandinya menimpa sandi pemilik dan ikut aktif saat kode
   dimasukkan; sekarang sandi apa pun tidak pernah sampai ke Supabase
   sebelum kodenya cocok. */
r = await panggil("POST", "/api/akun/daftar", {
  body: { ...sah, nama: "Penyerobot", sandi: "punyapenyerang", peran: "warga" },
});
assert.equal(r.status, 202);

/* --- verifikasi: profil terbentuk, peran terbawa, sesi langsung ada --- */
r = await panggil("POST", "/api/akun/daftar/verifikasi", {
  body: { ...sah, kode: `${KODE_UJI.slice(0, 3)} ${KODE_UJI.slice(3)}` },
});
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
lulus("POST /akun/daftar/verifikasi → 201, profil + peran + sesi");

r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: sah.hp, sandi: "punyapenyerang" },
});
assert.equal(r.status, 401, "sandi penyerobot tidak pernah aktif");
lulus(
  "daftar ulang nomor yang sedang menunggu kode tidak bisa menitipkan sandi",
);

/* SMS dibatasi per nomor: 3 per jam. */
for (let i = 0; i < 3; i++) {
  r = await panggil("POST", "/api/akun/daftar", {
    body: { ...sah, hp: "0856 1234 5678" },
  });
  assert.equal(r.status, 202);
}
r = await panggil("POST", "/api/akun/daftar", {
  body: { ...sah, hp: "0856 1234 5678" },
});
assert.equal(r.status, 429);
lulus("kirim kode ke satu nomor ke-4 dalam sejam → 429");

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
    kirimKode: async () => {
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

/* --- lupa sandi --- */
const lupaTerdaftar = await panggil("POST", "/api/akun/lupa-sandi", {
  body: { hp: "+62 813-1111-2222" },
});
const lupaAsing = await panggil("POST", "/api/akun/lupa-sandi", {
  body: { hp: "0899 1234 0000" },
});
assert.equal(lupaTerdaftar.status, 202);
assert.deepEqual(
  lupaTerdaftar,
  lupaAsing,
  "jawaban identik: tidak membocorkan nomor terdaftar",
);
assert.deepEqual(
  akun.dikirimKode.slice(-1),
  ["081311112222"],
  "SMS hanya ke nomor yang punya akun",
);
assert.equal(akun.dikirimKode.includes("089912340000"), false);
lulus(
  "POST /akun/lupa-sandi → 202 sama untuk semua nomor, SMS hanya ke yang terdaftar",
);

r = await panggil("POST", "/api/akun/lupa-sandi/atur-ulang", {
  body: { hp: sah.hp, kode: "000000", sandi: "sandibaru99" },
});
assert.equal(r.status, 422);
r = await panggil("POST", "/api/akun/lupa-sandi/atur-ulang", {
  body: { hp: "0899 1234 0000", kode: KODE_UJI, sandi: "sandibaru99" },
});
assert.equal(
  r.status,
  422,
  "nomor tak terdaftar = kode salah, tidak ada petunjuk lain",
);
r = await panggil("POST", "/api/akun/lupa-sandi/atur-ulang", {
  body: { hp: sah.hp, kode: KODE_UJI, sandi: "sandibaru99" },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.ok(
  akun.dicabut.some((t) => t.startsWith("semua:")),
  "semua sesi lama dicabut",
);
r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: sah.hp, sandi: sah.sandi },
});
assert.equal(r.status, 401, "sandi lama tidak berlaku lagi");
r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: sah.hp, sandi: "sandibaru99" },
});
assert.equal(r.status, 200);
lulus("POST /akun/lupa-sandi/atur-ulang → sandi baru aktif, sesi lama dicabut");

/* Kembalikan sandi awal supaya pemeriksaan di bawah tetap memakai `sah`. */
await akun.aturUlangSandi("081311112222", KODE_UJI, sah.sandi);

/* --- tebak-tebakan dibatasi per nomor --- */
/* Masuk yang berhasil menghapus hitungan sisa pemeriksaan di atas. */
r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: "081311112222", sandi: "rahasia123" },
});
assert.equal(r.status, 200);
for (let i = 0; i < 5; i++) {
  r = await panggil("POST", "/api/akun/masuk", {
    body: { hp: "081311112222", sandi: `tebakan-${i}` },
  });
  assert.equal(r.status, 401);
}
r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: "+62 813 1111 2222", sandi: "rahasia123" },
});
assert.equal(
  r.status,
  429,
  "percobaan ke-6 ditolak walau sandinya benar, apa pun format nomornya",
);
r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: "089900000000", sandi: "rahasia123" },
});
assert.equal(r.status, 401, "nomor lain tidak ikut terkunci");
lulus("6x tebak sandi satu nomor → 429, nomor lain tidak terdampak");

/* Jendela & reset, dengan jam yang bisa digeser. */
let jam = 0;
const b = buatPembatas(2, 1000, () => jam);
assert.ok(b.boleh("x") && b.boleh("x"));
assert.equal(b.boleh("x"), false);
jam = 1000;
assert.ok(b.boleh("x"), "jendela lewat → boleh lagi");
b.boleh("x");
b.lupakan("x");
assert.ok(b.boleh("x") && b.boleh("x"), "berhasil masuk → hitungan dari nol");
lulus("pembatas: jendela 15 menit berlalu / berhasil → dibuka lagi");

/* Banjir kunci baru tidak membuat peta tumbuh tanpa batas, TAPI juga tidak
   melepas nomor yang sedang terkunci. */
const banjir = buatPembatas(2, 60_000, () => jam);
banjir.boleh("terkunci");
banjir.boleh("terkunci");
assert.equal(banjir.boleh("terkunci"), false);
/* Tiap kunci banjir baru sekali dicoba (di bawah batas) → boleh dibuang. */
for (let i = 0; i < 100_000; i++) banjir.boleh(`k${i}`);
assert.ok(
  banjir.boleh("baru"),
  "peta penuh kunci biasa tetap menerima kunci baru",
);
assert.equal(
  banjir.boleh("terkunci"),
  false,
  "banjir kunci tidak membuka nomor terkunci",
);
lulus("pembatas: maksimal 100 ribu kunci, nomor terkunci tidak ikut terbuang");

/* Seluruh peta terkunci → kunci baru ditolak (gagal tertutup). */
const penuh = buatPembatas(0, 60_000, () => jam);
for (let i = 0; i < 100_000; i++) penuh.boleh(`p${i}`);
assert.equal(penuh.boleh("baru"), false);
lulus("pembatas: peta penuh nomor terkunci → kunci baru ditolak");

r = await panggil("POST", "/api/akun/masuk", {
  body: { hp: "bukan-nomor", sandi: "rahasia123" },
});
assert.equal(r.status, 422, "isian sampah ditolak sebelum menyentuh pembatas");

/* --- galat validasi API: bahasa warga, satu pesan per kolom --- */
r = await panggil("POST", "/api/akun/daftar", { body: { nama: "Siti" } });
assert.equal(r.status, 422);
assert.deepEqual(r.body.rincian, [
  { kolom: "peran", pesan: "Pilih daftar sebagai warga atau pengurus RT/RW." },
  { kolom: "hp", pesan: "Wajib diisi." },
  { kolom: "sandi", pesan: "Wajib diisi." },
]);
for (const x of r.body.rincian)
  assert.doesNotMatch(x.pesan, /Expected/, "tidak ada pesan TypeBox mentah");

const rusak = await app.handle(
  new Request("http://local/api/akun/masuk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{hp:",
  }),
);
assert.equal(rusak.status, 400, "JSON rusak = salah kiriman, bukan 500");
lulus("validasi API: pesan Indonesia, kolom tidak ganda, JSON rusak → 400");

/* Integer dibungkus Elysia jadi anyOf(angka | teks-angka): tetap dibaca
   sebagai angka, bukan "pilihan tidak dikenal". */
const integer = {
  minimum: 1,
  anyOf: [
    { type: "string", format: "integer" },
    { type: "integer", minimum: 1 },
  ],
};
assert.equal(pesanValidasi(integer, 0), "Minimal 1.");
assert.equal(pesanValidasi(integer, "dua"), "Harus berupa angka.");
assert.equal(
  pesanValidasi({ anyOf: [{ const: "a" }, { const: "b" }] }, "c"),
  "Pilihannya tidak dikenal.",
);
assert.equal(
  pesanValidasi({ type: "string", format: "uuid" }, "x"),
  "Pilihannya tidak dikenal.",
);
assert.equal(
  pesanValidasi({ type: "array", minItems: 1 }, []),
  "Pilih minimal 1.",
);
assert.equal(pesanValidasi({ type: "boolean" }, "ya"), "Harus ya atau tidak.");
assert.equal(
  pesanValidasi({ type: "string", error: "Pesan khusus." }, 1),
  "Pesan khusus.",
);
lulus("pesanValidasi: angka, pilihan, uuid, daftar, pesan khusus");

/* --- klien GoTrue: bentuk permintaan & arti jawabannya (fetch distub) --- */
const asli = globalThis.fetch;
const terkirim: {
  url: string;
  method?: string;
  izin?: string;
  badan: Record<string, unknown>;
}[] = [];
let jawab: (url: string) => [number, object];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  terkirim.push({
    url,
    method: init.method,
    izin: (init.headers as Record<string, string>).authorization,
    badan: JSON.parse(String(init.body)),
  });
  const [kode, isi] = jawab(url);
  return new Response(JSON.stringify(isi), { status: kode });
}) as typeof fetch;
try {
  const supa = buatSupabaseAuth("https://x.supabase.co", "kunci");
  const isian = { sandi: "rahasia123", nama: "Siti", peran: "warga" as const };

  jawab = () => [200, {}];
  await supa.kirimKode("081311112222");
  assert.equal(terkirim[0].url, "https://x.supabase.co/auth/v1/otp");
  assert.deepEqual(
    terkirim[0].badan,
    { phone: "6281311112222", create_user: true, channel: "sms" },
    "minta kode: 62xx, TANPA sandi maupun nama",
  );
  jawab = () => [429, { error_code: "over_sms_send_rate_limit" }];
  await assert.rejects(
    supa.kirimKode("081311112222"),
    (e: GalatAkun) => e.status === 429,
  );

  terkirim.length = 0;
  jawab = (url) =>
    url.endsWith("/verify")
      ? [
          200,
          {
            access_token: "a",
            refresh_token: "r",
            expires_in: 60,
            user: { id: "u1" },
          },
        ]
      : [200, {}];
  assert.deepEqual(await supa.verifikasi("081311112222", "123456", isian), {
    penggunaId: "u1",
    sesi: { accessToken: "a", refreshToken: "r", expiresIn: 60 },
  });
  assert.deepEqual(terkirim[0].badan, {
    type: "sms",
    phone: "6281311112222",
    token: "123456",
  });
  assert.equal(terkirim[1].url, "https://x.supabase.co/auth/v1/user");
  assert.equal(terkirim[1].method, "PUT");
  assert.equal(
    terkirim[1].izin,
    "Bearer a",
    "sandi dipasang dengan token pemilik nomor",
  );
  assert.deepEqual(terkirim[1].badan, {
    password: "rahasia123",
    data: { full_name: "Siti", role: "warga" },
  });

  jawab = () => [403, { error_code: "otp_expired" }];
  await assert.rejects(
    supa.verifikasi("081311112222", "999999", isian),
    (e: GalatAkun) => e.status === 422,
  );
  /* Kode sudah terpakai: jangan suruh daftar ulang, arahkan ke Lupa sandi. */
  jawab = (url) =>
    url.endsWith("/verify")
      ? [200, { access_token: "a", refresh_token: "r", user: { id: "u1" } }]
      : [422, { error_code: "weak_password" }];
  await assert.rejects(
    supa.verifikasi("081311112222", "123456", isian),
    (e: GalatAkun) => /Lupa sandi/.test(e.pesan),
  );
  lulus(
    "klien GoTrue: /otp tanpa sandi → /verify → PUT /user dengan token warga",
  );

  terkirim.length = 0;
  jawab = () => [200, {}];
  await supa.kirimKode("081311112222", false);
  assert.equal(
    terkirim[0].badan.create_user,
    false,
    "lupa sandi tidak membuat akun baru",
  );

  terkirim.length = 0;
  jawab = (url) =>
    url.endsWith("/verify")
      ? [200, { access_token: "a", refresh_token: "r", user: { id: "u1" } }]
      : [200, {}];
  await supa.aturUlangSandi("081311112222", "123456", "sandibaru99");
  assert.deepEqual(
    terkirim.map((x) => [
      x.url.replace("https://x.supabase.co/auth/v1", ""),
      x.izin,
    ]),
    [
      ["/verify", "Bearer kunci"],
      ["/user", "Bearer a"],
      ["/logout?scope=global", "Bearer a"],
    ],
  );
  assert.deepEqual(terkirim[1].badan, { password: "sandibaru99" });
  lulus(
    "klien GoTrue: atur ulang → /verify → PUT /user → logout semua perangkat",
  );

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
