/** Jalankan: npm run test:riwayat */
import assert from "node:assert/strict";
import { lulus, siapkan, tanggalISO } from "../test/bantu";

const { klien, db, app, panggil, schema } = await siapkan();

const WARGA = "11111111-1111-1111-1111-111111111111";
const LAIN = "22222222-2222-2222-2222-222222222222";
await db.insert(schema.users).values([
  { id: WARGA, fullName: "Bu Rina", phone: "0811" },
  { id: LAIN, fullName: "Pak Agus", phone: "0822" },
]);

const [ch] = await db
  .insert(schema.rwChannels)
  .values({ name: "RW 05 Sukamaju", areaCode: "3573" })
  .returning();

const [alamat] = await db
  .insert(schema.addresses)
  .values({
    userId: WARGA,
    label: "Rumah",
    fullAddress: "Jl. Kenanga No. 12",
    rwChannelId: ch.id,
    isDefault: true,
  })
  .returning();
const [alamatLain] = await db
  .insert(schema.addresses)
  .values({
    userId: LAIN,
    label: "Rumah",
    fullAddress: "Jl. Melati No. 4",
    rwChannelId: ch.id,
    isDefault: true,
  })
  .returning();

const [pagi] = await db
  .insert(schema.timeSlots)
  .values({ label: "06.00–08.00", startTime: "06:00:00", endTime: "08:00:00" })
  .returning();

const [organik, plastik] = await db
  .insert(schema.wasteCategories)
  .values([
    { slug: "organik", name: "Organik" },
    { slug: "plastik", name: "Plastik" },
  ])
  .returning();

let n = 0;
async function jemput(opsi: {
  tanggal: string;
  status: "menunggu" | "dijemput" | "selesai" | "batal";
  beratKg?: string;
  petugas?: string;
  catatan?: string;
  userId?: string;
  addressId?: string;
  jenis?: string[];
}) {
  const [p] = await db
    .insert(schema.pickups)
    .values({
      code: `PY-${3000 + n++}`,
      userId: opsi.userId ?? WARGA,
      addressId: opsi.addressId ?? alamat.id,
      channelId: ch.id,
      pickupDate: opsi.tanggal,
      timeSlotId: pagi.id,
      status: opsi.status,
      totalWeightKg: opsi.beratKg ?? null,
      officerName: opsi.petugas ?? null,
      notes: opsi.catatan ?? null,
    })
    .returning();
  const kategori = { organik: organik.id, plastik: plastik.id };
  for (const slug of opsi.jenis ?? []) {
    await db
      .insert(schema.pickupItems)
      .values({ pickupId: p.id, categoryId: kategori[slug as "organik"] });
  }
  return p;
}

let r = await panggil("GET", "/api/riwayat");
assert.equal(r.status, 401);
lulus("tanpa identitas → 401");

r = await panggil("GET", "/api/riwayat", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.deepEqual(r.body.data, [], "belum ada yang berakhir → riwayat kosong");
lulus("belum ada pengangkutan selesai → riwayat kosong");

const selesaiLama = await jemput({
  tanggal: tanggalISO(-40),
  status: "selesai",
  beratKg: "4.50",
  petugas: "Pak Dedi",
  jenis: ["organik"],
});
const selesaiBaru = await jemput({
  tanggal: tanggalISO(-3),
  status: "selesai",
  beratKg: "7.25",
  petugas: "Pak Dedi",
  catatan: "Karung di pos ronda",
  jenis: ["organik", "plastik"],
});
const dibatalkan = await jemput({ tanggal: tanggalISO(-10), status: "batal" });

/* Yang TIDAK boleh ikut. */
await jemput({ tanggal: tanggalISO(1), status: "menunggu" });
await jemput({ tanggal: tanggalISO(0), status: "dijemput" });
await jemput({
  tanggal: tanggalISO(-5),
  status: "selesai",
  beratKg: "9.00",
  userId: LAIN,
  addressId: alamatLain.id,
});

r = await panggil("GET", "/api/riwayat", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.deepEqual(
  r.body.data.map((p: any) => p.id),
  [selesaiBaru.id, dibatalkan.id, selesaiLama.id],
  "hanya selesai & batal milik sendiri, terbaru dulu",
);
lulus("hanya selesai & batal milik sendiri, terurut terbaru dulu");

const baru = r.body.data[0];
assert.equal(baru.status, "selesai");
assert.equal(Number(baru.totalWeightKg), 7.25, "berat timbangan terbawa");
assert.equal(baru.officerName, "Pak Dedi");
assert.equal(baru.notes, "Karung di pos ronda");
assert.equal(baru.jam, "06.00–08.00");
assert.equal(baru.alamatLabel, "Rumah");
assert.equal(baru.alamatLengkap, "Jl. Kenanga No. 12");
assert.equal(baru.channelName, "RW 05 Sukamaju");
assert.ok(baru.code.startsWith("PY-"));
assert.deepEqual([...baru.jenis].sort(), ["organik", "plastik"]);
lulus("baris memuat berat, petugas, catatan, jam, alamat, channel & jenis");

/* Kolom yang dipakai pencarian di perangkat harus ADA, walau kosong —
   kalau tidak, mencari "Pak Dedi" di riwayat yang dibatalkan akan meledak. */
const batal = r.body.data[1];
assert.equal(batal.status, "batal");
assert.equal(batal.totalWeightKg, null, "yang batal tidak punya timbangan");
assert.equal(batal.officerName, null);
assert.equal(batal.notes, null);
assert.deepEqual(batal.jenis, [], "tanpa jenis → array kosong, bukan null");
lulus("pengangkutan batal: berat/petugas/catatan null, jenis array kosong");

/* Total bulanan yang dihitung layar harus bisa dirakit dari daftar ini. */
const totalKg = r.body.data.reduce(
  (t: number, p: any) => t + Number(p.totalWeightKg ?? 0),
  0,
);
assert.equal(totalKg, 11.75, "berat seluruh riwayat bisa dijumlahkan");
lulus("berat bisa dijumlahkan untuk total per bulan di layar");

r = await panggil("GET", "/api/riwayat", { sebagai: LAIN });
assert.equal(r.body.data.length, 1, "warga lain hanya melihat miliknya");
assert.equal(r.body.data[0].alamatLengkap, "Jl. Melati No. 4");
lulus("riwayat warga lain terpisah");

/* ── Unduh bukti pengangkutan ────────────────────────────────────────────── */

/** Badan bukti sebagai teks — `panggil()` hanya membaca JSON. */
async function unduhBukti(id: string, sebagai?: string) {
  const res = await app.handle(
    new Request(`http://local/api/riwayat/${id}/bukti`, {
      headers: sebagai ? { "x-user-id": sebagai } : {},
    }),
  );
  return { res, teks: await res.text() };
}

let b = await unduhBukti(selesaiBaru.id);
assert.equal(b.res.status, 401);
lulus("bukti tanpa identitas → 401");

b = await unduhBukti(selesaiBaru.id, WARGA);
assert.equal(b.res.status, 200);
assert.match(
  b.res.headers.get("content-type") ?? "",
  /^text\/plain/,
  "dikirim sebagai teks biasa",
);
assert.equal(
  b.res.headers.get("content-disposition"),
  `attachment; filename="bukti-${selesaiBaru.code}.txt"`,
  "diunduh dengan nama berkas berisi kode",
);
lulus("bukti terunduh sebagai lampiran teks bernama kode pesanan");

for (const petikan of [
  "TANDA TERIMA PENGANGKUTAN SAMPAH",
  `Kode       : ${selesaiBaru.code}`,
  "Jam        : 06.00–08.00",
  "Alamat     : Rumah — Jl. Kenanga No. 12",
  "Channel    : RW 05 Sukamaju",
  "Petugas    : Pak Dedi",
  "Berat total: 7,3 kg",
  "Catatan    : Karung di pos ronda",
]) {
  assert.ok(b.teks.includes(petikan), `bukti memuat "${petikan}"`);
}
assert.match(b.teks, /Jenis      : (Organik, Plastik|Plastik, Organik)/);
lulus("bukti memuat kode, jam, alamat, channel, petugas, berat, jenis & catatan");

/* Tanpa catatan barisnya hilang — bukan "Catatan    : " yang kosong. */
const tanpaCatatan = await unduhBukti(selesaiLama.id, WARGA);
assert.ok(!tanpaCatatan.teks.includes("Catatan"), "baris catatan ikut hilang");
assert.ok(tanpaCatatan.teks.includes("Berat total: 4,5 kg"));
lulus("tanpa catatan → barisnya tidak dicetak kosong");

/* Yang dibatalkan tidak punya timbangan maupun petugas: tanda terimanya akan
   menyesatkan kalau dibawa ke rapat RT. */
assert.equal((await unduhBukti(dibatalkan.id, WARGA)).res.status, 404);
lulus("pengangkutan batal → tidak ada bukti (404)");

assert.equal((await unduhBukti(selesaiBaru.id, LAIN)).res.status, 404);
lulus("bukti warga lain → 404, bukan 403");

assert.equal(
  (await unduhBukti("00000000-0000-0000-0000-000000000000", WARGA)).res.status,
  404,
);
assert.equal((await unduhBukti("bukan-uuid", WARGA)).res.status, 422);
lulus("id tidak dikenal → 404, id bukan uuid → 422");

await klien.close();
console.log("\nSemua pemeriksaan API riwayat lulus.");
