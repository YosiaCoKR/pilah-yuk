/** Jalankan: npm run test:jadwal */
import assert from "node:assert/strict";
import { lulus, siapkan, tanggalISO } from "../test/bantu";

const { klien, db, panggil, schema } = await siapkan();

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

const [pagi, sore] = await db
  .insert(schema.timeSlots)
  .values([
    { label: "06.00–08.00", startTime: "06:00:00", endTime: "08:00:00" },
    { label: "17.00–19.00", startTime: "17:00:00", endTime: "19:00:00" },
  ])
  .returning();

const [organik, plastik] = await db
  .insert(schema.wasteCategories)
  .values([
    { slug: "organik", name: "Organik" },
    { slug: "plastik", name: "Plastik" },
  ])
  .returning();

const [rutin] = await db
  .insert(schema.recurringSchedules)
  .values({
    userId: WARGA,
    addressId: alamat.id,
    timeSlotId: pagi.id,
    days: [2, 5],
    startDate: tanggalISO(-30),
  })
  .returning();

let n = 0;
async function pesan(opsi: {
  tanggal: string;
  slotId: string;
  status?: "menunggu" | "dijemput" | "selesai" | "batal";
  userId?: string;
  addressId?: string;
  rutinId?: string | null;
  jenis?: string[];
}) {
  const [p] = await db
    .insert(schema.pickups)
    .values({
      code: `PY-${1000 + n++}`,
      userId: opsi.userId ?? WARGA,
      addressId: opsi.addressId ?? alamat.id,
      channelId: ch.id,
      pickupDate: opsi.tanggal,
      timeSlotId: opsi.slotId,
      status: opsi.status ?? "menunggu",
      recurringScheduleId: opsi.rutinId ?? null,
    })
    .returning();

  const kategori = { organik: organik.id, plastik: plastik.id };
  for (const slug of opsi.jenis ?? []) {
    await db.insert(schema.pickupItems).values({
      pickupId: p.id,
      categoryId: kategori[slug as "organik"],
    });
  }
  return p;
}

let r = await panggil("GET", "/api/jadwal/mendatang");
assert.equal(r.status, 401);
lulus("tanpa identitas → 401");

r = await panggil("GET", "/api/jadwal/mendatang", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.deepEqual(r.body.data, [], "belum ada pesanan → daftar kosong");
lulus("warga tanpa jemput mendatang → daftar kosong");

/* Dua hari ke depan, slot sore DULU disimpan supaya urutan hasil benar-benar
   datang dari ORDER BY, bukan dari urutan insert. */
await pesan({ tanggal: tanggalISO(3), slotId: sore.id, jenis: ["plastik"] });
await pesan({
  tanggal: tanggalISO(1),
  slotId: sore.id,
  jenis: ["organik", "plastik"],
});
await pesan({
  tanggal: tanggalISO(1),
  slotId: pagi.id,
  status: "dijemput",
  rutinId: rutin.id,
  jenis: ["organik"],
});

/* Yang TIDAK boleh ikut. */
await pesan({ tanggal: tanggalISO(2), slotId: pagi.id, status: "selesai" });
await pesan({ tanggal: tanggalISO(2), slotId: pagi.id, status: "batal" });
await pesan({ tanggal: tanggalISO(-1), slotId: pagi.id, status: "menunggu" });
await pesan({
  tanggal: tanggalISO(1),
  slotId: pagi.id,
  userId: LAIN,
  addressId: alamatLain.id,
});

r = await panggil("GET", "/api/jadwal/mendatang", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.length, 3, "selesai/batal/tertinggal/warga lain keluar");
lulus("hanya menunggu & dijemput milik sendiri, tanggal hari ini ke depan");

assert.deepEqual(
  r.body.data.map((j: any) => [j.tanggal, j.jam]),
  [
    [tanggalISO(1), "06.00–08.00"],
    [tanggalISO(1), "17.00–19.00"],
    [tanggalISO(3), "17.00–19.00"],
  ],
  "terdekat dulu, lalu jam dalam hari yang sama",
);
lulus("urutan: tanggal terdekat dulu, jam menaik dalam hari yang sama");

const pertama = r.body.data[0];
assert.equal(pertama.status, "dijemput");
assert.equal(pertama.rutin, true, "pesanan dari jadwal rutin ditandai");
assert.equal(pertama.alamatLabel, "Rumah");
assert.equal(pertama.alamatLengkap, "Jl. Kenanga No. 12");
assert.equal(pertama.channelName, "RW 05 Sukamaju");
assert.deepEqual(pertama.jenis, ["organik"]);
assert.ok(pertama.code.startsWith("PY-"));
lulus("baris memuat jam, alamat, channel, jenis, kode & penanda rutin");

assert.equal(r.body.data[1].rutin, false, "pesanan satuan tidak ditandai rutin");
assert.deepEqual(
  [...r.body.data[1].jenis].sort(),
  ["organik", "plastik"],
  "dua jenis dalam satu pesanan tidak memecah barisnya",
);
lulus("pesanan satuan: rutin=false, dua jenis tetap satu baris");

/* Hapus jadwal rutin: pesanannya tetap mendatang, cuma tidak lagi "rutin". */
await klien.exec(`delete from recurring_schedules`);
r = await panggil("GET", "/api/jadwal/mendatang", { sebagai: WARGA });
assert.equal(r.body.data.length, 3, "pesanan tidak boleh ikut terhapus");
assert.equal(r.body.data[0].rutin, false);
lulus("jadwal rutin dihapus → pesanannya tetap tampil, penanda rutin lepas");

/* --- detail jadwal rutin --- */

r = await panggil("GET", "/api/jadwal/rutin");
assert.equal(r.status, 401);
lulus("rutin tanpa identitas → 401");

r = await panggil("GET", "/api/jadwal/rutin", { sebagai: LAIN });
assert.equal(r.status, 200);
assert.deepEqual(r.body.data, [], "warga tanpa jadwal rutin → daftar kosong");
lulus("warga tanpa jadwal rutin → daftar kosong");

/* Jadwal rutin tadi sudah dihapus pemeriksaan di atas — buat dua: sore dulu,
   supaya urutan hasil benar-benar datang dari ORDER BY jam. */
await db
  .insert(schema.recurringSchedules)
  .values({
    userId: WARGA,
    addressId: alamat.id,
    timeSlotId: sore.id,
    days: [6, 1],
    startDate: tanggalISO(-30),
    reminderEnabled: false,
  });
const [rutinPagi] = await db
  .insert(schema.recurringSchedules)
  .values({
    userId: WARGA,
    addressId: alamat.id,
    timeSlotId: pagi.id,
    days: [5, 2],
    startDate: tanggalISO(-30),
  })
  .returning();
await db.insert(schema.recurringScheduleItems).values([
  { scheduleId: rutinPagi.id, categoryId: organik.id },
  { scheduleId: rutinPagi.id, categoryId: plastik.id },
]);

r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.length, 2, "dua jadwal: pagi & sore");
assert.deepEqual(
  r.body.data.map((j: any) => j.jam),
  ["06.00–08.00", "17.00–19.00"],
  "terurut menurut jam mulai",
);
lulus("dua jadwal rutin terurut menurut jam mulai");

const jp = r.body.data[0];
assert.deepEqual(jp.hari, ["Selasa", "Jumat"], "hari urut Senin→Minggu");
assert.equal(jp.alamatLengkap, "Jl. Kenanga No. 12");
assert.equal(jp.channelName, "RW 05 Sukamaju");
assert.equal(jp.dijeda, false);
assert.equal(jp.jedaSampai, null);
assert.equal(jp.pengingat, true, "pengingat menyala secara bawaan");
assert.equal(jp.berjalan, true);
assert.deepEqual([...jp.jenis].sort(), ["organik", "plastik"]);
lulus("baris memuat hari, jam, alamat, channel, jenis, jeda & pengingat");

assert.deepEqual(
  r.body.data[1].hari,
  ["Senin", "Sabtu"],
  "urutan hari tidak mengikuti urutan simpan",
);
assert.equal(r.body.data[1].pengingat, false);
assert.deepEqual(r.body.data[1].jenis, [], "jadwal tanpa jenis → array kosong");
lulus("jadwal sore: hari diurutkan, pengingat mati, jenis kosong");

await klien.exec(
  `update recurring_schedules set is_paused = true, paused_until = '2027-01-01'
   where id = '${rutinPagi.id}'`,
);
r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
assert.equal(r.body.data[0].dijeda, true);
assert.equal(r.body.data[0].jedaSampai, "2027-01-01");
assert.equal(r.body.data[0].berjalan, false, "dijeda berarti tidak berjalan");
lulus("jadwal dijeda → berjalan=false, tanggal akhir jeda terbawa");

/* Belum mulai & sudah berakhir juga bukan "berjalan". */
await klien.exec(
  `update recurring_schedules
   set is_paused = false, paused_until = null, start_date = '${tanggalISO(5)}'
   where id = '${rutinPagi.id}'`,
);
r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
assert.equal(
  r.body.data[0].berjalan,
  false,
  "jadwal yang belum mulai belum berjalan",
);
await klien.exec(
  `update recurring_schedules
   set start_date = '${tanggalISO(-30)}', end_date = '${tanggalISO(-1)}'
   where id = '${rutinPagi.id}'`,
);
r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
assert.equal(
  r.body.data[0].berjalan,
  false,
  "jadwal yang sudah berakhir tidak berjalan",
);
lulus("belum mulai / sudah berakhir → berjalan=false meski tidak dijeda");

r = await panggil("GET", "/api/jadwal/rutin", { sebagai: LAIN });
assert.deepEqual(r.body.data, [], "jadwal warga lain tidak boleh bocor");
lulus("jadwal rutin warga lain tidak bocor");

/* --- buat jadwal rutin --- */

const [malam] = await db
  .insert(schema.timeSlots)
  .values({ label: "19.00–21.00", startTime: "19:00:00", endTime: "21:00:00" })
  .returning();
const [slotMati] = await db
  .insert(schema.timeSlots)
  .values({
    label: "03.00–05.00",
    startTime: "03:00:00",
    endTime: "05:00:00",
    isActive: false,
  })
  .returning();
await db
  .insert(schema.wasteCategories)
  .values({ slug: "campuran", name: "Campuran" });

const badanSah = {
  addressId: alamat.id,
  timeSlotId: malam.id,
  hari: ["Rabu", "sabtu"],
  jenis: ["organik"],
};

r = await panggil("POST", "/api/jadwal/rutin", { body: badanSah });
assert.equal(r.status, 401);
lulus("buat rutin tanpa identitas → 401");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, hari: [] },
});
assert.equal(r.status, 422, "jadwal tanpa satu hari pun ditolak validator");
lulus("hari kosong → 422");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, hari: ["Senen"] },
});
assert.equal(r.status, 422);
assert.deepEqual(r.body.rincian, ["senen"], "hari salah tulis disebutkan");
lulus("nama hari tidak dikenal → 422 + hari mana yang salah");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, mulai: tanggalISO(5), sampai: tanggalISO(1) },
});
assert.equal(r.status, 422);
lulus("tanggal selesai sebelum mulai → 422");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, addressId: alamatLain.id },
});
assert.equal(r.status, 404, "alamat warga lain tidak boleh dipakai");
lulus("alamat milik warga lain → 404");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, timeSlotId: slotMati.id },
});
assert.equal(r.status, 404);
lulus("slot jam tidak aktif → 404");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, jenis: ["kaca"] },
});
assert.equal(r.status, 422);
assert.deepEqual(r.body.rincian, ["kaca"]);
lulus("jenis sampah tidak dikenal → 422");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, jenis: ["campuran", "organik"] },
});
assert.equal(r.status, 422);
lulus("campuran digabung jenis lain → 422 (aturan sama dengan pesanan)");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: { ...badanSah, jenis: ["plastik", "organik", "organik"] },
});
assert.equal(r.status, 201);
assert.deepEqual(r.body.data.hari, ["Rabu", "Sabtu"], "hari urut Senin→Minggu");
assert.equal(r.body.data.mulai, tanggalISO(0), "mulai bawaan = hari ini");
assert.equal(r.body.data.sampai, null, "tanpa tanggal selesai = tanpa batas");
assert.equal(r.body.data.dijeda, false);
assert.equal(r.body.data.pengingat, true);
assert.deepEqual(
  [...r.body.data.jenis].sort(),
  ["organik", "plastik"],
  "jenis kembar dirapikan jadi satu",
);
lulus("201: hari dinormalkan, mulai bawaan hari ini, jenis kembar dirapikan");

r = await panggil("POST", "/api/jadwal/rutin", {
  sebagai: WARGA,
  body: badanSah,
});
assert.equal(r.status, 409, "alamat + jam yang sama tidak boleh dua jadwal");
lulus("jadwal kembar (alamat & jam sama) → 409");

/* Jadwal yang baru dibuat harus langsung terbaca di endpoint detail. */
r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
const malamnya = r.body.data.find((j: any) => j.jam === "19.00–21.00");
assert.ok(malamnya, "jadwal baru muncul di daftar rutin");
assert.deepEqual(malamnya.hari, ["Rabu", "Sabtu"]);
assert.equal(malamnya.berjalan, true);
assert.deepEqual([...malamnya.jenis].sort(), ["organik", "plastik"]);
lulus("jadwal baru langsung terbaca lewat GET /jadwal/rutin");

/* --- ubah jadwal rutin --- */

const idMalam = malamnya.id;
const badanUbah = {
  addressId: alamat.id,
  timeSlotId: malam.id,
  hari: ["Senin"],
  jenis: ["plastik"],
  pengingat: false,
};

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}`, { body: badanUbah });
assert.equal(r.status, 401);
lulus("ubah tanpa identitas → 401");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}`, {
  sebagai: LAIN,
  body: badanUbah,
});
assert.equal(r.status, 404, "jadwal warga lain dijawab 404, bukan 403");
lulus("ubah jadwal warga lain → 404");

r = await panggil(
  "PUT",
  "/api/jadwal/rutin/99999999-9999-9999-9999-999999999999",
  { sebagai: WARGA, body: badanUbah },
);
assert.equal(r.status, 404);
lulus("ubah id tak dikenal → 404");

r = await panggil(`PUT`, `/api/jadwal/rutin/${idMalam}`, {
  sebagai: WARGA,
  body: { ...badanUbah, hari: ["Senen"] },
});
assert.equal(r.status, 422);
assert.deepEqual(r.body.rincian, ["senen"]);
lulus("ubah dengan nama hari ngawur → 422 (validasi sama dengan buat)");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}`, {
  sebagai: WARGA,
  body: { ...badanUbah, jenis: ["campuran", "plastik"] },
});
assert.equal(r.status, 422);
lulus("ubah dengan campuran + jenis lain → 422");

/* Pindah ke jam yang sudah dipakai jadwal lain di alamat yang sama. */
r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}`, {
  sebagai: WARGA,
  body: { ...badanUbah, timeSlotId: sore.id },
});
assert.equal(r.status, 409);
lulus("ubah ke jam yang sudah punya jadwal → 409");

/* Jadwal malam sedang berjalan; jeda dulu untuk memastikan menyimpan
   perubahan TIDAK menyalakannya kembali. */
await klien.exec(
  `update recurring_schedules set is_paused = true, paused_until = '2027-02-01'
   where id = '${idMalam}'`,
);

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}`, {
  sebagai: WARGA,
  body: badanUbah,
});
assert.equal(r.status, 200);
assert.deepEqual(r.body.data.hari, ["Senin"]);
assert.deepEqual(r.body.data.jenis, ["plastik"]);
assert.equal(r.body.data.pengingat, false);
assert.equal(r.body.data.dijeda, true, "menyimpan perubahan tidak melepas jeda");
assert.equal(r.body.data.jedaSampai, "2027-02-01");
lulus("200: hari, jenis & pengingat berubah, status jeda tidak tersentuh");

r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
const sesudah = r.body.data.find((j: any) => j.id === idMalam);
assert.deepEqual(
  sesudah.jenis,
  ["plastik"],
  "jenis lama harus hilang, bukan menumpuk",
);
assert.deepEqual(sesudah.hari, ["Senin"]);
lulus("jenis diganti utuh — organik lama tidak tertinggal");

/* --- jeda & jalankan lagi --- */

/* Jadwal malam dijalankan lagi dulu, lalu diberi tiga jemput rutin:
   besok, 10 hari lagi, dan satu yang sudah "dijemput". */
r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/jalan`, {
  sebagai: WARGA,
});
assert.equal(r.status, 200);
assert.equal(r.body.data.dijeda, false);
assert.equal(r.body.data.jedaSampai, null);
lulus("jalankan lagi → dijeda=false, tanggal jeda dibersihkan");

const dekat = await pesan({
  tanggal: tanggalISO(1),
  slotId: malam.id,
  rutinId: idMalam,
});
const jauh = await pesan({
  tanggal: tanggalISO(10),
  slotId: malam.id,
  rutinId: idMalam,
});
const berjalan = await pesan({
  tanggal: tanggalISO(2),
  slotId: malam.id,
  status: "dijemput",
  rutinId: idMalam,
});
const satuan = await pesan({ tanggal: tanggalISO(1), slotId: pagi.id });

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/jeda`, {
  body: { sampai: null },
});
assert.equal(r.status, 401);
lulus("jeda tanpa identitas → 401");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/jeda`, {
  sebagai: LAIN,
  body: { sampai: null },
});
assert.equal(r.status, 404);
lulus("jeda jadwal warga lain → 404");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/jeda`, {
  sebagai: WARGA,
  body: { sampai: tanggalISO(-1) },
});
assert.equal(r.status, 422);
lulus("jeda sampai tanggal yang sudah lewat → 422");

/* Jeda 3 hari: hanya jemput besok yang masuk rentang. */
r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/jeda`, {
  sebagai: WARGA,
  body: { sampai: tanggalISO(3) },
});
assert.equal(r.status, 200);
assert.equal(r.body.data.dijeda, true);
assert.equal(r.body.data.jedaSampai, tanggalISO(3));
assert.equal(r.body.data.dibatalkan, 1, "hanya jemput di rentang jeda");
lulus("jeda berbatas → hanya jemput dalam rentang yang dibatalkan");

const status1 = await klien.query<{ id: string; status: string }>(
  `select id, status from pickups where id = any($1)`,
  [[dekat.id, jauh.id, berjalan.id, satuan.id]],
);
const peta = Object.fromEntries(status1.rows.map((b) => [b.id, b.status]));
assert.equal(peta[dekat.id], "batal");
assert.equal(peta[jauh.id], "menunggu", "di luar rentang jeda tidak tersentuh");
assert.equal(peta[berjalan.id], "dijemput", "petugas sudah berangkat");
assert.equal(peta[satuan.id], "menunggu", "pesanan satuan bukan milik jadwal");
lulus("jeda tidak menyentuh luar rentang, yang dijemput, & pesanan satuan");

/* Jeda ulang tanpa batas: jemput jauh ikut kena. */
r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/jeda`, {
  sebagai: WARGA,
  body: { sampai: null },
});
assert.equal(r.status, 200, "menjeda ulang dipakai untuk menggeser tanggal");
assert.equal(r.body.data.jedaSampai, null);
assert.equal(r.body.data.dibatalkan, 1, "sisa jemput rutin ikut dibatalkan");
lulus("jeda tanpa batas → semua jemput rutin ke depan dibatalkan");

r = await panggil("GET", "/api/jadwal/mendatang", { sebagai: WARGA });
assert.ok(
  !r.body.data.some((j: any) => j.id === jauh.id),
  "jemput yang dibatalkan hilang dari jadwal mendatang",
);
lulus("jemput yang dibatalkan hilang dari daftar jadwal mendatang");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/jalan`, {
  sebagai: WARGA,
});
assert.equal(r.body.data.dijeda, false);
const tetap = await klien.query<{ n: number }>(
  `select count(*)::int as n from pickups
   where recurring_schedule_id = '${idMalam}' and status = 'batal'`,
);
assert.equal(tetap.rows[0].n, 2, "jemput yang dibatalkan tidak dihidupkan lagi");
lulus("jalankan lagi tidak membangkitkan jemput yang sudah dibatalkan");

r = await panggil(
  "PUT",
  "/api/jadwal/rutin/99999999-9999-9999-9999-999999999999/jalan",
  { sebagai: WARGA },
);
assert.equal(r.status, 404);
lulus("jalankan id tak dikenal → 404");

/* --- toggle pengingat --- */

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/pengingat`, {
  body: { aktif: true },
});
assert.equal(r.status, 401);
lulus("pengingat tanpa identitas → 401");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/pengingat`, {
  sebagai: LAIN,
  body: { aktif: true },
});
assert.equal(r.status, 404);
lulus("pengingat jadwal warga lain → 404");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/pengingat`, {
  sebagai: WARGA,
  body: { aktif: "iya" },
});
assert.equal(r.status, 422, "aktif harus boolean, bukan teks");
lulus("aktif bukan boolean → 422");

/* Jadwal malam terakhir disimpan dengan pengingat mati (lihat ubah jadwal). */
r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/pengingat`, {
  sebagai: WARGA,
  body: { aktif: true },
});
assert.equal(r.status, 200);
assert.equal(r.body.data.pengingat, true);
lulus("nyalakan pengingat → 200, pengingat=true");

r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
assert.equal(
  r.body.data.find((j: any) => j.id === idMalam).pengingat,
  true,
  "perubahan terbaca di detail",
);
lulus("pengingat yang menyala terbaca lewat GET /jadwal/rutin");

r = await panggil("PUT", `/api/jadwal/rutin/${idMalam}/pengingat`, {
  sebagai: WARGA,
  body: { aktif: false },
});
assert.equal(r.body.data.pengingat, false);
r = await panggil("GET", "/api/jadwal/rutin", { sebagai: WARGA });
const sesudahMati = r.body.data.find((j: any) => j.id === idMalam);
assert.equal(sesudahMati.pengingat, false);
assert.deepEqual(
  sesudahMati.hari,
  ["Senin"],
  "mematikan pengingat tidak menyentuh hari jemput",
);
assert.equal(sesudahMati.dijeda, false, "tidak menyentuh status jeda");
lulus("matikan pengingat tidak mengubah hari maupun status jeda");

await klien.close();
console.log("\nSemua pemeriksaan API jadwal lulus.");
