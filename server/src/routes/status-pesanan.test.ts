/** Jalankan: npm run test:status */
import assert from "node:assert/strict";
import { berlangganan, lulus, siapkan, tanggalISO } from "../test/bantu";

const { klien, db, panggil, schema } = await siapkan();

const WARGA = "11111111-1111-1111-1111-111111111111";
const LAIN = "22222222-2222-2222-2222-222222222222";
await db.insert(schema.users).values([
  { id: WARGA, fullName: "Bu Rina", phone: "0811" },
  { id: LAIN, fullName: "Pak Dedi", phone: "0822" },
]);
await berlangganan(db, schema, WARGA, { kuota: 20 });

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
    landmark: "Sebelah warung Bu Tini",
    rwChannelId: ch.id,
    isDefault: true,
  })
  .returning();
const [slot] = await db
  .insert(schema.timeSlots)
  .values({
    label: "06.00–08.00",
    startTime: "06:00:00",
    endTime: "08:00:00",
    capacity: 50,
  })
  .returning();
await db
  .insert(schema.wasteCategories)
  .values([
    { slug: "organik", name: "Organik" },
    { slug: "plastik", name: "Plastik" },
  ]);

const buat = async (tanggal: string) => {
  const r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: {
      addressId: alamat.id,
      jenis: ["organik", "plastik"],
      tanggal,
      timeSlotId: slot.id,
      catatan: "Karung di depan pagar",
    },
  });
  assert.equal(r.status, 201);
  return r.body.data.id as string;
};

const menunggu = await buat(tanggalISO(1));
const dijemput = await buat(tanggalISO(2));
const selesai = await buat(tanggalISO(3));

await klien.exec(
  `update pickups set status = 'dijemput' where id = '${dijemput}'`,
);
await klien.exec(
  `update pickups set status = 'selesai', total_weight_kg = 6.40,
   officer_name = 'Pak Dedi' where id = '${selesai}'`,
);

/* --- detail --- */
let r = await panggil("GET", `/api/pesanan/${menunggu}`);
assert.equal(r.status, 401);
lulus("detail tanpa identitas → 401");

r = await panggil("GET", `/api/pesanan/${menunggu}`, { sebagai: LAIN });
assert.equal(r.status, 404, "pesanan warga lain harus 404, bukan 403");
lulus("detail pesanan warga lain → 404");

r = await panggil("GET", "/api/pesanan/99999999-9999-9999-9999-999999999999", {
  sebagai: WARGA,
});
assert.equal(r.status, 404);
lulus("detail id tak dikenal → 404");

r = await panggil("GET", `/api/pesanan/${menunggu}`, { sebagai: WARGA });
assert.equal(r.status, 200);
const d = r.body.data;
assert.equal(d.status, "menunggu");
assert.equal(d.jam, "06.00–08.00");
assert.equal(d.alamatLabel, "Rumah");
assert.equal(d.alamatPatokan, "Sebelah warung Bu Tini");
assert.equal(d.channelName, "RW 05 Sukamaju");
assert.equal(d.notes, "Karung di depan pagar");
assert.deepEqual([...d.jenis].sort(), ["organik", "plastik"]);
assert.equal(d.bisaDibatalkan, true);
lulus("detail membawa jam, alamat, patokan, channel, catatan, jenis");

/* --- linimasa --- */
assert.deepEqual(
  d.lini.map((l: any) => l.langkah),
  ["menunggu", "dijemput", "selesai"],
);
assert.deepEqual(
  d.lini.map((l: any) => l.lewat),
  [true, false, false],
  "baru langkah pertama yang dilalui",
);
assert.equal(d.lini.find((l: any) => l.kini).langkah, "menunggu");
lulus("linimasa: menunggu sedang berjalan, dua langkah lain belum");

r = await panggil("GET", `/api/pesanan/${selesai}`, { sebagai: WARGA });
assert.deepEqual(
  r.body.data.lini.map((l: any) => l.lewat),
  [true, true, true],
  "pesanan selesai melewati semua langkah",
);
assert.equal(r.body.data.totalWeightKg, "6.40");
assert.equal(r.body.data.officerName, "Pak Dedi");
assert.equal(r.body.data.bisaDibatalkan, false);
lulus("pesanan selesai: semua langkah lewat, berat & petugas terisi");

/* --- pesanan batal keluar dari linimasa --- */
r = await panggil("PUT", `/api/pesanan/${menunggu}/batal`, { sebagai: WARGA });
assert.equal(r.status, 200);
r = await panggil("GET", `/api/pesanan/${menunggu}`, { sebagai: WARGA });
assert.equal(r.body.data.status, "batal");
assert.deepEqual(
  r.body.data.lini.map((l: any) => l.lewat),
  [false, false, false],
  "pesanan batal tidak menempati langkah mana pun",
);
assert.equal(r.body.data.bisaDibatalkan, false);
lulus("pesanan batal → semua langkah kosong, tidak bisa dibatalkan lagi");

/* --- saring daftar per status --- */
r = await panggil("GET", "/api/pesanan", { sebagai: WARGA });
assert.equal(r.body.data.length, 3);
lulus("daftar tanpa saringan → 3 pesanan");

r = await panggil("GET", "/api/pesanan?status=selesai", { sebagai: WARGA });
assert.equal(r.body.data.length, 1);
assert.equal(r.body.data[0].id, selesai);
lulus("saring status=selesai → 1 pesanan");

r = await panggil("GET", "/api/pesanan?status=dijemput", { sebagai: WARGA });
assert.equal(r.body.data.length, 1);
assert.equal(r.body.data[0].id, dijemput);
lulus("saring status=dijemput → 1 pesanan");

r = await panggil("GET", "/api/pesanan?status=batal", { sebagai: WARGA });
assert.equal(r.body.data.length, 1);
lulus("saring status=batal → 1 pesanan");

r = await panggil("GET", "/api/pesanan?status=ngawur", { sebagai: WARGA });
assert.equal(r.status, 422, "status di luar daftar harus ditolak");
lulus("saring status tidak dikenal → 422");

/* --- urutan: tanggal terbaru lebih dulu --- */
r = await panggil("GET", "/api/pesanan", { sebagai: WARGA });
const tanggal = r.body.data.map((p: any) => p.tanggal);
assert.deepEqual(
  tanggal,
  [...tanggal].sort().reverse(),
  "pesanan terbaru harus di atas",
);
lulus("daftar terurut tanggal terbaru dulu");

/* --- jumlah angkut petugas (kartu "Diangkut oleh") ---
   Ditaruh paling akhir karena menambah pesanan baru; pemeriksaan daftar di
   atas menghitung jumlahnya. */

r = await panggil("GET", `/api/pesanan/${selesai}`, { sebagai: WARGA });
assert.equal(
  r.body.data.petugasJumlahAngkut,
  1,
  "pengangkutan ini sendiri sudah terhitung",
);
r = await panggil("GET", `/api/pesanan/${menunggu}`, { sebagai: WARGA });
assert.equal(
  r.body.data.petugasJumlahAngkut,
  0,
  "belum ada petugas → belum ada hitungan",
);
lulus("jumlah angkut petugas: terisi saat selesai, 0 saat belum ada petugas");

/* Satu angkut lagi oleh petugas yang sama di alamat yang sama → 2.
   Petugas lain dan alamat lain tidak boleh ikut terhitung. */
const lagi = await buat(tanggalISO(4));
const petugasLain = await buat(tanggalISO(5));
await klien.exec(
  `update pickups set status = 'selesai', total_weight_kg = 5.00,
   officer_name = 'Pak Dedi' where id = '${lagi}'`,
);
await klien.exec(
  `update pickups set status = 'selesai', total_weight_kg = 5.00,
   officer_name = 'Pak Yusuf' where id = '${petugasLain}'`,
);

const [alamatKedua] = await db
  .insert(schema.addresses)
  .values({
    userId: WARGA,
    label: "Warung",
    fullAddress: "Kios 7 Pasar Sukamaju",
    rwChannelId: ch.id,
  })
  .returning();
const diAlamatLain = await buat(tanggalISO(6));
await klien.exec(
  `update pickups
   set status = 'selesai', officer_name = 'Pak Dedi',
       address_id = '${alamatKedua.id}'
   where id = '${diAlamatLain}'`,
);

r = await panggil("GET", `/api/pesanan/${selesai}`, { sebagai: WARGA });
assert.equal(
  r.body.data.petugasJumlahAngkut,
  2,
  "hanya Pak Dedi di alamat yang sama",
);
r = await panggil("GET", `/api/pesanan/${petugasLain}`, { sebagai: WARGA });
assert.equal(r.body.data.petugasJumlahAngkut, 1, "Pak Yusuf dihitung sendiri");
lulus("jumlah angkut dibatasi petugas & alamat yang sama");

/* Yang belum selesai tidak menambah hitungan. */
await klien.exec(`update pickups set status = 'dijemput' where id = '${lagi}'`);
r = await panggil("GET", `/api/pesanan/${selesai}`, { sebagai: WARGA });
assert.equal(
  r.body.data.petugasJumlahAngkut,
  1,
  "yang masih dijemput belum terhitung sebagai angkut",
);
lulus("hanya pengangkutan selesai yang dihitung");

await klien.close();
console.log("\nSemua pemeriksaan API status pesanan lulus.");
