/**
 * Riwayat contoh: isinya benar, aman diulang, dan menolak basis data produksi.
 *
 * Jalankan: npm run test:contoh
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { WARGA_CONTOH, tanamContoh } from "./contoh";
import { lulus, siapkan } from "../test/bantu";

const { klien, db, panggil, schema } = await siapkan();

/* Data acuan belum ada → ditolak dengan arahan, bukan baris setengah jadi. */
const tanpaAcuan = await tanamContoh(db);
assert.ok("gagal" in tanpaAcuan && tanpaAcuan.gagal.includes("db:seed"));
assert.equal(
  (await db.select().from(schema.pickups)).length,
  0,
  "tidak boleh ada penjemputan yang tertinggal",
);
lulus("tanpa data acuan → ditolak, tidak ada baris setengah jadi");

await db.insert(schema.timeSlots).values([
  { label: "06.00–08.00", startTime: "06:00:00", endTime: "08:00:00" },
  { label: "09.00–11.00", startTime: "09:00:00", endTime: "11:00:00" },
]);
await db.insert(schema.wasteCategories).values([
  { slug: "organik", name: "Organik" },
  { slug: "plastik", name: "Plastik" },
  { slug: "kertas", name: "Kertas" },
  { slug: "campuran", name: "Campuran" },
]);
await db.insert(schema.subscriptionPlans).values({
  name: "Bulanan Rumah Tangga",
  billingCycle: "bulanan",
  price: 45000,
  pickupQuota: 8,
});

const pertama = await tanamContoh(db);
assert.deepEqual(pertama, { ditanam: 8 });
lulus("tanam pertama → 8 penjemputan");

/* Sekali lagi tidak boleh menumpuk warga atau riwayat kedua. */
assert.deepEqual(await tanamContoh(db), { lewat: "sudah-ada" });
assert.equal((await db.select().from(schema.pickups)).length, 8);
assert.equal((await db.select().from(schema.users)).length, 1);
assert.equal((await db.select().from(schema.addresses)).length, 3);
assert.equal((await db.select().from(schema.subscriptions)).length, 1);
lulus("dijalankan ulang → tidak menumpuk warga, alamat, langganan & riwayat");

/* Yang paling mudah salah: baris batal tidak boleh punya berat atau petugas. */
const semua = await db.select().from(schema.pickups);
const batal = semua.filter((p) => p.status === "batal");
assert.equal(batal.length, 1, "tepat satu contoh yang batal");
assert.equal(batal[0].totalWeightKg, null);
assert.equal(batal[0].officerName, null);
assert.ok(semua.every((p) => p.status === "batal" || p.totalWeightKg !== null));
lulus("yang batal tanpa berat & petugas, yang selesai selalu bertimbangan");

/* Tiap penjemputan punya rincian jenis — tanpa ini layar riwayat kosong
   chip-nya dan total per jenis jadi nol. */
for (const p of semua) {
  const item = await db
    .select()
    .from(schema.pickupItems)
    .where(eq(schema.pickupItems.pickupId, p.id));
  assert.ok(item.length > 0, `${p.code} harus punya rincian jenis`);
}
lulus("semua penjemputan contoh punya rincian jenis");

/* Lintas bulan: itulah gunanya tanggal relatif — pengelompokan bulan dan
   total berat per bulan di layar riwayat harus punya lebih dari satu kelompok. */
const bulan = new Set(semua.map((p) => p.pickupDate.slice(0, 7)));
assert.ok(bulan.size >= 3, `riwayat harus lintas bulan, dapat ${bulan.size}`);
lulus(`riwayat contoh menyebar di ${bulan.size} bulan`);

/* Dan layar riwayat betul-betul bisa membacanya lewat API. */
const r = await panggil("GET", "/api/riwayat", { sebagai: WARGA_CONTOH });
assert.equal(r.status, 200);
assert.equal(r.body.data.length, 8, "semua contoh sudah berakhir → ikut riwayat");
assert.ok(
  r.body.data.some((p: { catatan?: string; notes?: string }) => p.notes),
  "ada contoh yang punya catatan",
);
lulus("riwayat contoh terbaca lewat GET /api/riwayat");

/* Pagar produksi: basis data yang sudah berisi warga lain ditolak. */
const LAIN = "22222222-2222-2222-2222-222222222222";
await db
  .insert(schema.users)
  .values({ id: LAIN, fullName: "Pak Agus", phone: "0822" });
const [alamatLain] = await db
  .insert(schema.addresses)
  .values({ userId: LAIN, label: "Rumah", fullAddress: "Jl. Melati No. 4" })
  .returning();
const [slotAda] = await db.select().from(schema.timeSlots).limit(1);
await db.insert(schema.pickups).values({
  code: "PY-9001",
  userId: LAIN,
  addressId: alamatLain.id,
  pickupDate: "2026-01-02",
  timeSlotId: slotAda.id,
});

const ditolak = await tanamContoh(db);
assert.ok("gagal" in ditolak && ditolak.gagal.includes("warga lain"));
lulus("ada penjemputan warga lain → menolak menanam (pagar produksi)");

await klien.close();
console.log("\nSemua pemeriksaan riwayat contoh lulus.");
