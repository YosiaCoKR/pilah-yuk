/** Jalankan: npm run test:umpan-balik */
import assert from "node:assert/strict";
import { lulus, siapkan } from "../test/bantu";

const { klien, db, panggil, schema } = await siapkan();

const WARGA = "11111111-1111-1111-1111-111111111111";
const LAIN = "22222222-2222-2222-2222-222222222222";
await db.insert(schema.users).values([
  { id: WARGA, fullName: "Bu Rina", phone: "0811" },
  { id: LAIN, fullName: "Pak Agus", phone: "0822" },
]);
const [alamat] = await db
  .insert(schema.addresses)
  .values({ userId: WARGA, label: "Rumah", fullAddress: "Jl. Kenanga No. 12" })
  .returning();
const [alamatLain] = await db
  .insert(schema.addresses)
  .values({ userId: LAIN, label: "Rumah", fullAddress: "Jl. Melati No. 4" })
  .returning();
const [slot] = await db
  .insert(schema.timeSlots)
  .values({ label: "06–08", startTime: "06:00", endTime: "08:00" })
  .returning();

let n = 0;
const jemput = async (
  status: "menunggu" | "selesai",
  tanggal: string,
  userId = WARGA,
) =>
  (
    await db
      .insert(schema.pickups)
      .values({
        code: `PY-${7000 + n++}`,
        userId,
        addressId: userId === WARGA ? alamat.id : alamatLain.id,
        pickupDate: tanggal,
        timeSlotId: slot.id,
        status,
        officerName: "Pak Dedi",
      })
      .returning()
  )[0];

const lama = await jemput("selesai", "2026-10-20");
const baru = await jemput("selesai", "2026-10-27");
const belum = await jemput("menunggu", "2026-11-30");
const milikLain = await jemput("selesai", "2026-10-27", LAIN);

let r = await panggil("GET", "/api/umpan-balik");
assert.equal(r.status, 401);
lulus("tanpa identitas → 401");

r = await panggil("GET", "/api/umpan-balik", { sebagai: WARGA });
assert.deepEqual(
  r.body.data.menunggu.map((p: any) => p.pickupId),
  [baru.id, lama.id],
  "hanya jemput selesai milik sendiri, terbaru dulu",
);
assert.deepEqual(r.body.data.terkirim, []);
lulus("GET: menunggu = jemput selesai milik sendiri, terbaru dulu");

r = await panggil("POST", "/api/umpan-balik", {
  sebagai: WARGA,
  body: { pickupId: baru.id, rating: 6 },
});
assert.equal(r.status, 422, "rating 6 harus 422");
lulus("rating di luar 1–5 → 422");

r = await panggil("POST", "/api/umpan-balik", {
  sebagai: WARGA,
  body: { pickupId: belum.id, rating: 5 },
});
assert.equal(r.status, 409, "jemput belum selesai harus 409");
r = await panggil("POST", "/api/umpan-balik", {
  sebagai: WARGA,
  body: { pickupId: milikLain.id, rating: 1 },
});
assert.equal(r.status, 404, "jemput orang lain harus 404");
lulus("belum selesai → 409, milik orang lain → 404");

r = await panggil("POST", "/api/umpan-balik", {
  sebagai: WARGA,
  body: {
    pickupId: baru.id,
    rating: 5,
    tags: ["Petugas ramah", " Petugas ramah "],
    comment: "  Dibantu angkat karung.  ",
  },
});
assert.equal(r.status, 201);
assert.deepEqual(r.body.data.tags, ["Petugas ramah"], "tanda ganda dirapikan");
assert.equal(r.body.data.comment, "Dibantu angkat karung.");
lulus("POST → 201, tanda kembar & spasi dirapikan");

/* Dua ketukan bersamaan: tepat satu yang lolos. */
const dua = await Promise.all(
  [4, 3].map((rating) =>
    panggil("POST", "/api/umpan-balik", {
      sebagai: WARGA,
      body: { pickupId: lama.id, rating },
    }),
  ),
);
assert.deepEqual(dua.map((x) => x.status).sort(), [201, 409]);
r = await panggil("POST", "/api/umpan-balik", {
  sebagai: WARGA,
  body: { pickupId: baru.id, rating: 1 },
});
assert.equal(r.status, 409, "kiriman kedua harus 409");
lulus(
  "kirim ganda (bersamaan maupun berurutan) → tepat satu tersimpan, sisanya 409",
);

r = await panggil("GET", "/api/umpan-balik", { sebagai: WARGA });
assert.deepEqual(r.body.data.menunggu, []);
assert.equal(r.body.data.terkirim.length, 2);
assert.equal(r.body.data.terkirim[0].officerName, "Pak Dedi");
r = await panggil("GET", "/api/umpan-balik", { sebagai: LAIN });
assert.deepEqual(
  r.body.data.terkirim,
  [],
  "warga lain tidak melihat penilaian orang",
);
lulus("GET sesudahnya: pindah ke terkirim; warga lain tidak melihatnya");

await klien.close();
console.log("\nSemua pemeriksaan API umpan balik lulus.");
