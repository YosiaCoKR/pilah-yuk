/** Jalankan: npm run test:pesanan */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { berlangganan, lulus, siapkan, tanggalISO } from "../test/bantu";

const { klien, db, panggil, schema } = await siapkan();

const WARGA = "11111111-1111-1111-1111-111111111111";
const LAIN = "22222222-2222-2222-2222-222222222222";
await db.insert(schema.users).values([
  { id: WARGA, fullName: "Bu Rina", phone: "0811" },
  { id: LAIN, fullName: "Pak Dedi", phone: "0822" },
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
const [alamatOrangLain] = await db
  .insert(schema.addresses)
  .values({ userId: LAIN, label: "Rumah", fullAddress: "Jl. Melati No. 4" })
  .returning();

const [slot] = await db
  .insert(schema.timeSlots)
  .values({
    label: "06.00–08.00",
    startTime: "06:00:00",
    endTime: "08:00:00",
    capacity: 2,
    sortOrder: 1,
  })
  .returning();

await db.insert(schema.wasteCategories).values([
  { slug: "organik", name: "Organik" },
  { slug: "plastik", name: "Plastik" },
  { slug: "kertas", name: "Kertas" },
  { slug: "campuran", name: "Campuran" },
]);

await berlangganan(db, schema, WARGA, { kuota: 20 });

const BESOK = tanggalISO(1);
const dasar = {
  addressId: alamat.id,
  jenis: ["organik", "plastik"],
  tanggal: BESOK,
  timeSlotId: slot.id,
};

let r = await panggil("POST", "/api/pesanan", { body: dasar });
assert.equal(r.status, 401);
lulus("tanpa identitas → 401");

r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, jenis: [] },
});
assert.equal(r.status, 422);
lulus("tanpa jenis sampah → 422");

r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, tanggal: tanggalISO(-2) },
});
assert.equal(r.status, 422);
lulus("tanggal kemarin → 422");

r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, addressId: alamatOrangLain.id },
});
assert.equal(r.status, 404, "alamat orang lain tidak boleh dipakai");
lulus("pakai alamat orang lain → 404");

r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, jenis: ["organik", "emas"] },
});
assert.equal(r.status, 422);
assert.deepEqual(r.body.rincian, ["emas"]);
lulus("jenis tak dikenal → 422 dan menyebut yang salah");

r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, jenis: ["campuran", "organik"] },
});
assert.equal(r.status, 422);
lulus("campuran digabung jenis lain → 422");

/* --- pesanan berhasil --- */
r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, catatan: "  Karung di depan pagar  " },
});
assert.equal(r.status, 201);
assert.match(r.body.data.code, /^PY-\d{4}$/, "kode harus PY-####");
assert.equal(r.body.data.status, "menunggu");
const pesanan1 = r.body.data.id;
lulus(`POST /pesanan → 201, kode ${r.body.data.code}, status menunggu`);

const [tersimpan] = await db.select().from(schema.pickups);
assert.equal(tersimpan.channelId, ch.id, "channel diambil dari alamat");
assert.equal(tersimpan.notes, "Karung di depan pagar", "catatan di-trim");
lulus("channel terisi dari alamat, catatan ter-trim");

const items = await db.select().from(schema.pickupItems);
assert.equal(items.length, 2, "dua jenis sampah tersimpan");
lulus("pickup_items tersimpan 2 baris");

/* --- jenis duplikat tidak menggandakan baris --- */
r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, jenis: ["kertas", "kertas"] },
});
assert.equal(r.status, 201);
const pesanan2 = r.body.data.id;
const items2 = await db
  .select()
  .from(schema.pickupItems)
  .where(eq(schema.pickupItems.pickupId, pesanan2));
assert.equal(items2.length, 1, "kertas dua kali harus jadi satu baris saja");
lulus("jenis duplikat tidak menggandakan baris pickup_items");

/* --- kuota penuh --- */
r = await panggil("POST", "/api/pesanan", { sebagai: WARGA, body: dasar });
assert.equal(r.status, 409, "slot kapasitas 2 sudah terisi 2");
assert.match(r.body.pesan, /penuh/i);
lulus("pesanan ketiga di slot berkapasitas 2 → 409 kuota penuh");

/* --- hari lain masih bisa --- */
r = await panggil("POST", "/api/pesanan", {
  sebagai: WARGA,
  body: { ...dasar, tanggal: tanggalISO(2) },
});
assert.equal(r.status, 201);
lulus("hari lain masih punya kuota → 201");

/* --- daftar pesanan --- */
r = await panggil("GET", "/api/pesanan", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.length, 3);
const satu = r.body.data.find((p: any) => p.id === pesanan1);
assert.deepEqual(
  [...satu.jenis].sort(),
  ["organik", "plastik"],
  "jenis ikut terbawa",
);
assert.equal(satu.jam, "06.00–08.00");
assert.equal(satu.alamatLabel, "Rumah");
assert.equal(satu.channelName, "RW 05 Sukamaju");
lulus("GET /pesanan membawa jenis, jam, alamat, dan channel");

r = await panggil("GET", "/api/pesanan", { sebagai: LAIN });
assert.deepEqual(r.body.data, []);
lulus("warga lain tidak melihat pesanan orang");

/* --- pembatalan --- */
r = await panggil("PUT", `/api/pesanan/${pesanan1}/batal`, { sebagai: LAIN });
assert.equal(r.status, 404);
lulus("batalkan pesanan orang lain → 404");

r = await panggil("PUT", `/api/pesanan/${pesanan1}/batal`, { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.status, "batal");
lulus("batalkan pesanan sendiri → 200");

r = await panggil("PUT", `/api/pesanan/${pesanan1}/batal`, { sebagai: WARGA });
assert.equal(r.status, 409);
lulus("batalkan dua kali → 409");

/* --- kuota kembali setelah pembatalan --- */
r = await panggil("POST", "/api/pesanan", { sebagai: WARGA, body: dasar });
assert.equal(r.status, 201, "kuota yang dibatalkan harus bisa dipakai lagi");
lulus("kuota kembali setelah pembatalan → 201");

/* --- tidak bisa batal setelah petugas berangkat --- */
await klien.exec(
  `update pickups set status = 'dijemput' where id = '${pesanan2}'`,
);
r = await panggil("PUT", `/api/pesanan/${pesanan2}/batal`, { sebagai: WARGA });
assert.equal(r.status, 409);
assert.match(r.body.pesan, /berangkat/i);
lulus("batal setelah status dijemput → 409");

await klien.close();
console.log("\nSemua pemeriksaan API pesanan lulus.");
