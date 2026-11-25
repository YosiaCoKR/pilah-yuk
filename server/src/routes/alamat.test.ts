/**
 * Menjalankan app Elysia yang sama seperti produksi, di atas Postgres
 * sementara (PGlite) — tanpa kredensial Supabase.
 *
 * Jalankan: npm run test:api
 */
import assert from "node:assert/strict";
import { lulus, siapkan } from "../test/bantu";

const WARGA = "11111111-1111-1111-1111-111111111111";
const ORANG_LAIN = "22222222-2222-2222-2222-222222222222";

const { klien, db, panggil, schema } = await siapkan();

await db.insert(schema.users).values([
  { id: WARGA, fullName: "Bu Rina", phone: "0811" },
  { id: ORANG_LAIN, fullName: "Pak Dedi", phone: "0822" },
]);
const [channel] = await db
  .insert(schema.rwChannels)
  .values({ name: "RW 05 Sukamaju", areaCode: "3573" })
  .returning();

/* --- tanpa identitas --- */
let r = await panggil("GET", "/api/alamat");
assert.equal(r.status, 401, "tanpa header harus 401");
lulus("GET /alamat tanpa identitas → 401");

/* --- daftar kosong --- */
r = await panggil("GET", "/api/alamat", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.deepEqual(r.body.data, []);
lulus("daftar awal kosong");

/* --- validasi --- */
r = await panggil("POST", "/api/alamat", {
  sebagai: WARGA,
  body: { label: "", fullAddress: "pendek" },
});
assert.equal(r.status, 422, "isian tidak sah harus 422");
assert.ok(Array.isArray(r.body.rincian) && r.body.rincian.length > 0);
lulus(`isian tidak sah → 422 (${r.body.rincian.length} kolom ditandai)`);

/* --- buat --- */
r = await panggil("POST", "/api/alamat", {
  sebagai: WARGA,
  body: {
    label: "  Rumah  ",
    fullAddress: "Jl. Kenanga No. 12, RT 03 / RW 05",
    landmark: "Sebelah warung Bu Tini",
    rwChannelId: channel.id,
    isDefault: true,
  },
});
assert.equal(r.status, 201);
assert.equal(r.body.data.label, "Rumah", "label harus di-trim");
assert.equal(r.body.data.isDefault, true);
const rumah = r.body.data.id;
lulus("POST /alamat → 201, label ter-trim, jadi utama");

r = await panggil("POST", "/api/alamat", {
  sebagai: WARGA,
  body: {
    label: "Warung",
    fullAddress: "Kios 7 Pasar Sukamaju, RT 06",
    isDefault: true,
  },
});
assert.equal(r.status, 201);
const warung = r.body.data.id;
lulus("POST alamat utama kedua → 201 (yang lama otomatis turun)");

/* --- hanya satu yang utama, dan utama ada di urutan pertama --- */
r = await panggil("GET", "/api/alamat", { sebagai: WARGA });
assert.equal(r.body.data.length, 2);
assert.equal(
  r.body.data.filter((a: any) => a.isDefault).length,
  1,
  "hanya boleh satu alamat utama",
);
assert.equal(r.body.data[0].id, warung, "alamat utama harus di urutan pertama");
lulus("tepat satu alamat utama, dan ia di urutan pertama");

/* --- join channel ikut terbawa --- */
const dgnChannel = r.body.data.find((a: any) => a.id === rumah);
assert.equal(dgnChannel.rwChannelName, "RW 05 Sukamaju");
lulus("nama channel RW ikut terbawa lewat join");

/* --- pindah alamat utama --- */
r = await panggil("PUT", `/api/alamat/${rumah}/utama`, { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.isDefault, true);
r = await panggil("GET", "/api/alamat", { sebagai: WARGA });
assert.equal(r.body.data.filter((a: any) => a.isDefault).length, 1);
assert.equal(r.body.data[0].id, rumah);
lulus("PUT /:id/utama memindahkan status utama");

/* --- id asing harus rollback, bukan menurunkan yang lama --- */
r = await panggil(
  "PUT",
  "/api/alamat/99999999-9999-9999-9999-999999999999/utama",
  { sebagai: WARGA },
);
assert.equal(r.status, 404, "id tak dikenal harus 404, bukan 500");
r = await panggil("GET", "/api/alamat", { sebagai: WARGA });
assert.equal(
  r.body.data.filter((a: any) => a.isDefault).length,
  1,
  "alamat utama lama harus tetap utama setelah rollback",
);
lulus("id tak dikenal → 404, alamat utama lama tidak ikut turun");

/* --- isolasi antar warga --- */
r = await panggil("GET", "/api/alamat", { sebagai: ORANG_LAIN });
assert.deepEqual(r.body.data, [], "warga lain tidak boleh melihat alamat ini");
lulus("warga lain tidak melihat alamat orang");

r = await panggil("PATCH", `/api/alamat/${rumah}`, {
  sebagai: ORANG_LAIN,
  body: { label: "Dibajak" },
});
assert.equal(r.status, 404, "ubah alamat orang lain harus 404");
lulus("PATCH alamat orang lain → 404");

r = await panggil("DELETE", `/api/alamat/${rumah}`, { sebagai: ORANG_LAIN });
assert.equal(r.status, 404, "hapus alamat orang lain harus 404");
lulus("DELETE alamat orang lain → 404");

r = await panggil("PUT", `/api/alamat/${warung}/utama`, {
  sebagai: ORANG_LAIN,
});
assert.equal(r.status, 404, "jadikan utama alamat orang lain harus 404");
r = await panggil("GET", "/api/alamat", { sebagai: WARGA });
assert.equal(
  r.body.data[0].id,
  rumah,
  "alamat utama pemilik tidak boleh berubah",
);
lulus("PUT /:id/utama alamat orang lain → 404, utama pemilik tetap");

/* --- ubah & hapus milik sendiri --- */
r = await panggil("PATCH", `/api/alamat/${warung}`, {
  sebagai: WARGA,
  body: { landmark: "Blok daging, pintu timur" },
});
assert.equal(r.status, 200);
assert.equal(r.body.data.landmark, "Blok daging, pintu timur");
lulus("PATCH milik sendiri → 200");

r = await panggil("DELETE", `/api/alamat/${warung}`, { sebagai: WARGA });
assert.equal(r.status, 200);
r = await panggil("GET", "/api/alamat", { sebagai: WARGA });
assert.equal(r.body.data.length, 1);
lulus("DELETE milik sendiri → 200, daftar menyusut");

/* --- hapus alamat utama: yang tersisa naik jadi utama --- */
r = await panggil("POST", "/api/alamat", {
  sebagai: WARGA,
  body: { label: "Kantor", fullAddress: "Jl. Merdeka No. 9, RT 01" },
});
const kantor = r.body.data.id;
r = await panggil("DELETE", `/api/alamat/${rumah}`, { sebagai: WARGA });
assert.equal(r.status, 200);
r = await panggil("GET", "/api/alamat", { sebagai: WARGA });
assert.deepEqual(
  r.body.data.map((a: any) => [a.id, a.isDefault]),
  [[kantor, true]],
  "alamat yang tersisa harus naik jadi utama",
);
lulus("DELETE alamat utama → alamat lain naik jadi utama");

/* --- dipakai riwayat jemput → 409, bukan 500 --- */
const [slot] = await db
  .insert(schema.timeSlots)
  .values({ label: "06–08", startTime: "06:00", endTime: "08:00", capacity: 5 })
  .returning();
await db.insert(schema.pickups).values({
  code: "PY-9001",
  userId: WARGA,
  addressId: kantor,
  pickupDate: "2026-11-03",
  timeSlotId: slot.id,
});
r = await panggil("DELETE", `/api/alamat/${kantor}`, { sebagai: WARGA });
assert.equal(r.status, 409, "alamat yang dipakai riwayat harus 409");
lulus("DELETE alamat yang dipakai riwayat jemput → 409");

/* === profil === */
r = await panggil("GET", "/api/profil");
assert.equal(r.status, 401);
r = await panggil("GET", "/api/profil", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.fullName, "Bu Rina");
assert.equal(r.body.data.phone, "0811");
lulus("GET /profil → 200 milik sendiri, tanpa identitas → 401");

r = await panggil("PATCH", "/api/profil", {
  sebagai: WARGA,
  body: {
    fullName: "  Rina Sari  ",
    email: "pak.dedi@contoh.id",
    phone: "0899",
  },
});
assert.equal(r.status, 200);
assert.equal(r.body.data.fullName, "Rina Sari");
assert.equal(r.body.data.phone, "0811", "nomor HP tidak boleh berubah di sini");
assert.equal(
  r.body.data.email,
  null,
  "email tidak boleh diklaim tanpa verifikasi",
);
lulus(
  "PATCH /profil: nama berubah; HP & email (identitas akun) tidak tersentuh",
);

r = await panggil("PATCH", "/api/profil", { sebagai: WARGA, body: {} });
assert.equal(r.status, 422, "tanpa nama harus 422");
r = await panggil("PATCH", "/api/profil", {
  sebagai: WARGA,
  body: { fullName: "R" },
});
assert.equal(r.status, 422);
lulus("PATCH /profil isian kosong/terlalu pendek → 422");

await klien.close();
console.log("\nSemua pemeriksaan API alamat & profil lulus.");
