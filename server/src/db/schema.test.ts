/**
 * Memastikan migrasi benar-benar jalan di Postgres asli (PGlite, in-process)
 * dan constraint yang tidak terlihat dari TypeScript benar-benar menggigit.
 *
 * Jalankan: npm run db:check
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { beriHakSupabase, pasangPrasyaratSupabase } from "../test/bantu";

const DIR = new URL("../../drizzle/", import.meta.url).pathname;

async function gagal(db: PGlite, sql: string, params: unknown[], kenapa: string) {
  await assert.rejects(
    () => db.query(sql, params),
    (e: Error) => {
      console.log(`  ✓ ditolak: ${kenapa}`);
      return e instanceof Error;
    },
    `seharusnya ditolak: ${kenapa}`,
  );
}

const db = new PGlite();
await pasangPrasyaratSupabase(db);

const berkas = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
assert.ok(berkas.length > 0, "tidak ada file migrasi di drizzle/");

for (const f of berkas) {
  const isi = readFileSync(join(DIR, f), "utf8");
  for (const pernyataan of isi.split("--> statement-breakpoint")) {
    if (pernyataan.trim()) await db.exec(pernyataan);
  }
  console.log(`✓ migrasi jalan: ${f}`);
}
await beriHakSupabase(db);

const tabel = await db.query<{ table_name: string }>(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`,
);
const nama = tabel.rows.map((r) => r.table_name);
assert.deepEqual(nama, [
  "addresses",
  "pickup_items",
  "pickups",
  "recurring_schedule_items",
  "recurring_schedules",
  "rw_channels",
  "subscription_plans",
  "subscriptions",
  "time_slots",
  "users",
  "waste_categories",
]);
console.log(`✓ ${nama.length} tabel terbentuk`);

/* --- data dasar --- */
const U = "11111111-1111-1111-1111-111111111111";
await db.query(
  `insert into users (id, full_name, phone) values ($1, 'Bu Rina', '0811')`,
  [U],
);
const ch = await db.query<{ id: string }>(
  `insert into rw_channels (name, area_code) values ('RW 05 Sukamaju', '3573') returning id`,
);
const kat = await db.query<{ id: string }>(
  `insert into waste_categories (slug, name) values ('organik', 'Organik') returning id`,
);
const slot = await db.query<{ id: string }>(
  `insert into time_slots (label, start_time, end_time, capacity)
   values ('06.00-08.00', '06:00', '08:00', 2) returning id`,
);
const alamat = await db.query<{ id: string }>(
  `insert into addresses (user_id, label, full_address, rw_channel_id, is_default)
   values ($1, 'Rumah', 'Jl. Kenanga No. 12', $2, true) returning id`,
  [U, ch.rows[0].id],
);
console.log("✓ users / channel / kategori / slot / alamat tersimpan");

/* --- constraint yang harus menggigit --- */

await gagal(
  db,
  `insert into users (id, full_name) values ($1, 'Tanpa Kontak')`,
  ["22222222-2222-2222-2222-222222222222"],
  "user tanpa phone maupun email",
);

await gagal(
  db,
  `insert into addresses (user_id, label, full_address, is_default)
   values ($1, 'Kedua', 'Jl. Melati No. 4', true)`,
  [U],
  "alamat utama kedua untuk warga yang sama",
);

// ...tapi alamat non-utama kedua harus boleh.
const alamat2 = await db.query<{ id: string }>(
  `insert into addresses (user_id, label, full_address, is_default)
   values ($1, 'Warung', 'Kios 7 Pasar Sukamaju', false) returning id`,
  [U],
);
console.log("  ✓ diterima: alamat kedua yang bukan utama");

const pk = await db.query<{ id: string; status: string }>(
  `insert into pickups (code, user_id, address_id, channel_id, pickup_date, time_slot_id)
   values ('PY-4833', $1, $2, $3, '2026-11-03', $4)
   returning id, status`,
  [U, alamat.rows[0].id, ch.rows[0].id, slot.rows[0].id],
);
assert.equal(pk.rows[0].status, "menunggu", "status awal harus menunggu");
console.log("✓ pickup tersimpan, status default 'menunggu'");

await gagal(
  db,
  `insert into pickups (code, user_id, address_id, pickup_date, time_slot_id)
   values ('PY-4833', $1, $2, '2026-11-04', $3)`,
  [U, alamat.rows[0].id, slot.rows[0].id],
  "kode pesanan duplikat",
);

await gagal(
  db,
  `update pickups set total_weight_kg = -1 where id = $1`,
  [pk.rows[0].id],
  "berat negatif",
);

await gagal(
  db,
  `insert into pickups (code, user_id, address_id, pickup_date, time_slot_id, status)
   values ('PY-9999', $1, $2, '2026-11-04', $3, 'ngawur')`,
  [U, alamat.rows[0].id, slot.rows[0].id],
  "status di luar enum",
);

await db.query(
  `insert into pickup_items (pickup_id, category_id, estimated_weight_kg)
   values ($1, $2, 3.5)`,
  [pk.rows[0].id, kat.rows[0].id],
);
await gagal(
  db,
  `insert into pickup_items (pickup_id, category_id) values ($1, $2)`,
  [pk.rows[0].id, kat.rows[0].id],
  "kategori sama dua kali dalam satu pesanan",
);

await gagal(
  db,
  `delete from addresses where id = $1`,
  [alamat.rows[0].id],
  "hapus alamat yang masih dipakai pesanan (riwayat harus utuh)",
);

await gagal(
  db,
  `insert into time_slots (label, start_time, end_time, capacity)
   values ('bolong', '06:00', '08:00', 0)`,
  [],
  "slot dengan kapasitas 0",
);

await gagal(
  db,
  `insert into time_slots (label, start_time, end_time)
   values ('terbalik', '09:00', '07:00')`,
  [],
  "slot dengan jam selesai sebelum jam mulai",
);

// Satu langganan aktif per warga.
const paket = await db.query<{ id: string }>(
  `insert into subscription_plans (name, billing_cycle, price, pickup_quota)
   values ('Bulanan Rumah Tangga', 'bulanan', 45000, 8) returning id`,
);
await db.query(
  `insert into subscriptions (user_id, plan_id, status, start_date, end_date)
   values ($1, $2, 'aktif', '2026-10-01', '2026-11-01')`,
  [U, paket.rows[0].id],
);
await gagal(
  db,
  `insert into subscriptions (user_id, plan_id, status, start_date, end_date)
   values ($1, $2, 'aktif', '2026-11-01', '2026-12-01')`,
  [U, paket.rows[0].id],
  "langganan aktif kedua untuk warga yang sama",
);
await gagal(
  db,
  `insert into subscriptions (user_id, plan_id, status, start_date, end_date)
   values ($1, $2, 'menunggu_bayar', '2026-12-01', '2026-11-01')`,
  [U, paket.rows[0].id],
  "periode langganan terbalik (selesai sebelum mulai)",
);

/* --- kolom yang dibaca layar Riwayat ---
   Tabelnya sudah ada sejak migrasi pertama; yang dijaga di sini adalah
   KONTRAKNYA. Layar riwayat, detail pengangkutan, dan tanda terima membaca
   kolom-kolom ini apa adanya, jadi migrasi berikutnya tidak boleh
   menghilangkannya tanpa ada yang gagal lebih dulu. */
const kolom = async (tabel: string) =>
  (
    await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1`,
      [tabel],
    )
  ).rows.map((r) => r.column_name);

const kolomPickup = await kolom("pickups");
for (const k of [
  "code",
  "pickup_date",
  "status",
  "total_weight_kg",
  "officer_name",
  "proof_url",
  "notes",
  "recurring_schedule_id",
]) {
  assert.ok(kolomPickup.includes(k), `pickups.${k} dibaca layar riwayat`);
}
const kolomItem = await kolom("pickup_items");
for (const k of ["pickup_id", "category_id", "estimated_weight_kg"]) {
  assert.ok(kolomItem.includes(k), `pickup_items.${k} dibaca rincian sampah`);
}
console.log("✓ kolom yang dibaca layar Riwayat lengkap");

/* Bukti & berat boleh kosong selama pengangkutan belum selesai — riwayat
   menampilkan baris yang masih "menunggu" juga. */
const belum = await db.query<{
  total_weight_kg: string | null;
  officer_name: string | null;
  proof_url: string | null;
}>(`select total_weight_kg, officer_name, proof_url from pickups where id = $1`, [
  pk.rows[0].id,
]);
assert.equal(belum.rows[0].total_weight_kg, null);
assert.equal(belum.rows[0].officer_name, null);
assert.equal(belum.rows[0].proof_url, null);

await db.query(
  `update pickups
   set status = 'selesai', total_weight_kg = 7.25,
       officer_name = 'Pak Dedi', proof_url = 'bukti/py-4833.jpg'
   where id = $1`,
  [pk.rows[0].id],
);
const sudah = await db.query<{ total_weight_kg: string }>(
  `select total_weight_kg from pickups where id = $1`,
  [pk.rows[0].id],
);
assert.equal(
  Number(sudah.rows[0].total_weight_kg),
  7.25,
  "berat timbangan menyimpan dua angka desimal",
);
await db.query(`update pickups set status = 'menunggu' where id = $1`, [
  pk.rows[0].id,
]);
console.log("✓ berat, petugas & bukti boleh kosong lalu terisi saat selesai");

/* --- jadwal rutin --- */
const rutin = await db.query<{
  id: string;
  is_paused: boolean;
  reminder_enabled: boolean;
}>(
  `insert into recurring_schedules (user_id, address_id, time_slot_id, days, start_date)
   values ($1, $2, $3, '{2,5}', '2026-11-01')
   returning id, is_paused, reminder_enabled`,
  [U, alamat.rows[0].id, slot.rows[0].id],
);
assert.equal(rutin.rows[0].is_paused, false, "jadwal baru tidak boleh dijeda");
assert.equal(
  rutin.rows[0].reminder_enabled,
  true,
  "pengingat menyala secara bawaan",
);
console.log("✓ jadwal rutin tersimpan (Selasa & Jumat), default masuk");

await db.query(
  `insert into recurring_schedule_items (schedule_id, category_id) values ($1, $2)`,
  [rutin.rows[0].id, kat.rows[0].id],
);
await gagal(
  db,
  `insert into recurring_schedule_items (schedule_id, category_id) values ($1, $2)`,
  [rutin.rows[0].id, kat.rows[0].id],
  "kategori sama dua kali dalam satu jadwal rutin",
);

await gagal(
  db,
  `insert into recurring_schedules (user_id, address_id, time_slot_id, days, start_date)
   values ($1, $2, $3, '{7}', '2026-11-01')`,
  [U, alamat2.rows[0].id, slot.rows[0].id],
  "hari di luar 0-6",
);

await gagal(
  db,
  `insert into recurring_schedules (user_id, address_id, time_slot_id, days, start_date)
   values ($1, $2, $3, '{}', '2026-11-01')`,
  [U, alamat2.rows[0].id, slot.rows[0].id],
  "jadwal rutin tanpa satu hari pun",
);

await gagal(
  db,
  `insert into recurring_schedules (user_id, address_id, time_slot_id, days, start_date, end_date)
   values ($1, $2, $3, '{1}', '2026-11-10', '2026-11-01')`,
  [U, alamat2.rows[0].id, slot.rows[0].id],
  "periode jadwal terbalik (selesai sebelum mulai)",
);

await gagal(
  db,
  `update recurring_schedules set paused_until = '2026-12-01' where id = $1`,
  [rutin.rows[0].id],
  "tanggal akhir jeda padahal jadwal tidak dijeda",
);

await gagal(
  db,
  `insert into recurring_schedules (user_id, address_id, time_slot_id, days, start_date)
   values ($1, $2, $3, '{3}', '2026-12-01')`,
  [U, alamat.rows[0].id, slot.rows[0].id],
  "jadwal kembar untuk alamat & slot jam yang sama",
);

// Pesanan yang lahir dari jadwal rutin menunjuk balik ke jadwalnya, dan tetap
// ada sebagai riwayat setelah jadwalnya dihapus.
await db.query(
  `update pickups set recurring_schedule_id = $1 where id = $2`,
  [rutin.rows[0].id, pk.rows[0].id],
);
await db.query(`delete from recurring_schedules where id = $1`, [
  rutin.rows[0].id,
]);
const yatim = await db.query<{ recurring_schedule_id: string | null; n: number }>(
  `select recurring_schedule_id, count(*)::int as n from pickups
   where id = $1 group by recurring_schedule_id`,
  [pk.rows[0].id],
);
assert.equal(yatim.rows[0].n, 1, "pesanan harus tetap ada sebagai riwayat");
assert.equal(
  yatim.rows[0].recurring_schedule_id,
  null,
  "tautan ke jadwal yang dihapus harus jadi null",
);
console.log("✓ hapus jadwal rutin tidak menghapus riwayat pesanannya");

// Hapus warga harus ikut menghapus pesanannya (cascade).
await db.query(`delete from users where id = $1`, [U]);
const sisa = await db.query<{ n: number }>(
  `select count(*)::int as n from pickups`,
);
assert.equal(sisa.rows[0].n, 0, "pickup harus ikut terhapus bersama user");
console.log("✓ hapus user men-cascade ke pickups");

await db.close();
console.log("\nSemua pemeriksaan skema lulus.");
