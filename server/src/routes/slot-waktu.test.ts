/** Jalankan: npm run test:slot */
import assert from "node:assert/strict";
import { lulus, siapkan, tanggalISO } from "../test/bantu";

const { klien, db, panggil, schema } = await siapkan();

const WARGA = "11111111-1111-1111-1111-111111111111";
await db
  .insert(schema.users)
  .values({ id: WARGA, fullName: "Bu Rina", phone: "0811" });

const [ch] = await db
  .insert(schema.rwChannels)
  .values({ name: "RW 05 Sukamaju", areaCode: "3573" })
  .returning();
const [chLain] = await db
  .insert(schema.rwChannels)
  .values({ name: "RW 07 Sukamaju", areaCode: "3573" })
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

const [pagi, siang] = await db
  .insert(schema.timeSlots)
  .values([
    {
      label: "06.00–08.00",
      startTime: "06:00:00",
      endTime: "08:00:00",
      note: "Paling sering dipilih",
      capacity: 2,
      sortOrder: 1,
    },
    {
      label: "09.00–11.00",
      startTime: "09:00:00",
      endTime: "11:00:00",
      note: "Petugas lewat setelah pasar",
      capacity: 5,
      sortOrder: 2,
    },
  ])
  .returning();
// Slot khusus satu channel — tidak boleh bocor ke channel lain.
await db.insert(schema.timeSlots).values({
  label: "17.00–19.00",
  startTime: "17:00:00",
  endTime: "19:00:00",
  note: "Sebelum magrib",
  capacity: 4,
  sortOrder: 3,
  channelId: ch.id,
});

const BESOK = tanggalISO(1);

let r = await panggil("GET", `/api/slot-waktu?tanggal=${BESOK}`);
assert.equal(r.status, 401);
lulus("tanpa identitas → 401");

r = await panggil("GET", "/api/slot-waktu?tanggal=bukan-tanggal", {
  sebagai: WARGA,
});
assert.equal(r.status, 422);
lulus("format tanggal salah → 422");

r = await panggil("GET", `/api/slot-waktu?tanggal=${tanggalISO(-1)}`, {
  sebagai: WARGA,
});
assert.equal(r.status, 422);
lulus("tanggal kemarin → 422");

/* --- tanpa channel: hanya slot umum --- */
r = await panggil("GET", `/api/slot-waktu?tanggal=${BESOK}`, { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.length, 2, "slot khusus channel tidak boleh ikut");
assert.deepEqual(
  r.body.data.map((s: any) => s.range),
  ["06.00–08.00", "09.00–11.00"],
  "urutan harus mengikuti sortOrder",
);
assert.equal(r.body.data[0].sisaKuota, 2);
assert.equal(r.body.data[0].full, false);
lulus("slot umum saja, terurut, kuota penuh tersedia");

/* --- dengan channel: slot umum + slot channel itu --- */
r = await panggil(
  "GET",
  `/api/slot-waktu?tanggal=${BESOK}&channelId=${ch.id}`,
  { sebagai: WARGA },
);
assert.equal(r.body.data.length, 3);
lulus("dengan channelId → slot umum + slot milik channel");

r = await panggil(
  "GET",
  `/api/slot-waktu?tanggal=${BESOK}&channelId=${chLain.id}`,
  { sebagai: WARGA },
);
assert.equal(r.body.data.length, 2, "slot channel lain tidak boleh bocor");
lulus("channel lain tidak melihat slot khusus milik RW 05");

/* --- kuota berkurang saat ada pesanan --- */
const pesan = (tanggal: string, slotId: string, status = "menunggu") =>
  db.insert(schema.pickups).values({
    code: `PY-${Math.random().toString().slice(2, 8)}`,
    userId: WARGA,
    addressId: alamat.id,
    channelId: ch.id,
    pickupDate: tanggal,
    timeSlotId: slotId,
    status: status as "menunggu",
  });

await pesan(BESOK, pagi.id);
r = await panggil(
  "GET",
  `/api/slot-waktu?tanggal=${BESOK}&channelId=${ch.id}`,
  { sebagai: WARGA },
);
assert.equal(r.body.data[0].sisaKuota, 1, "satu pesanan memakan satu kuota");
lulus("satu pesanan → sisa kuota turun jadi 1");

await pesan(BESOK, pagi.id);
r = await panggil(
  "GET",
  `/api/slot-waktu?tanggal=${BESOK}&channelId=${ch.id}`,
  { sebagai: WARGA },
);
assert.equal(r.body.data[0].sisaKuota, 0);
assert.equal(r.body.data[0].full, true);
assert.equal(r.body.data[0].note, "Kuota penuh", "catatan diganti saat penuh");
assert.equal(r.body.data[1].sisaKuota, 5, "slot lain tidak ikut terpengaruh");
lulus("slot penuh ditandai full + catatan 'Kuota penuh'");

/* --- pesanan batal mengembalikan kuota --- */
await klien.exec(`update pickups set status = 'batal'`);
r = await panggil(
  "GET",
  `/api/slot-waktu?tanggal=${BESOK}&channelId=${ch.id}`,
  { sebagai: WARGA },
);
assert.equal(r.body.data[0].sisaKuota, 2, "pesanan batal tidak memakan kuota");
assert.equal(r.body.data[0].full, false);
lulus("pesanan batal mengembalikan kuota");

/* --- kuota terpisah per tanggal --- */
await klien.exec(`update pickups set status = 'menunggu'`);
r = await panggil(
  "GET",
  `/api/slot-waktu?tanggal=${tanggalISO(2)}&channelId=${ch.id}`,
  { sebagai: WARGA },
);
assert.equal(r.body.data[0].sisaKuota, 2, "kuota dihitung per tanggal");
lulus("kuota hari lain tidak terbawa");

await klien.close();
console.log("\nSemua pemeriksaan API slot waktu lulus.");
