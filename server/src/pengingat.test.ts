/** Jalankan: npm run test:pengingat */
import assert from "node:assert/strict";
import { pengingatUntuk } from "./pengingat";
import { lulus, siapkan, tanggalISO } from "./test/bantu";

const { klien, db, schema } = await siapkan();

const WARGA = "11111111-1111-1111-1111-111111111111";
await db
  .insert(schema.users)
  .values({ id: WARGA, fullName: "Bu Rina", phone: "0811" });

const [alamat] = await db
  .insert(schema.addresses)
  .values({
    userId: WARGA,
    label: "Rumah",
    fullAddress: "Jl. Kenanga No. 12",
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

const [organik] = await db
  .insert(schema.wasteCategories)
  .values({ slug: "organik", name: "Organik" })
  .returning();

let n = 0;
async function jadwal(opsi: {
  slotId: string;
  pengingat?: boolean;
  dijeda?: boolean;
  jedaSampai?: string | null;
  mulai?: string;
  sampai?: string | null;
}) {
  const [j] = await db
    .insert(schema.recurringSchedules)
    .values({
      userId: WARGA,
      addressId: alamat.id,
      timeSlotId: opsi.slotId,
      days: [1, 4],
      startDate: opsi.mulai ?? tanggalISO(-30),
      endDate: opsi.sampai ?? null,
      isPaused: opsi.dijeda ?? false,
      pausedUntil: opsi.jedaSampai ?? null,
      reminderEnabled: opsi.pengingat ?? true,
    })
    .returning();
  await db
    .insert(schema.recurringScheduleItems)
    .values({ scheduleId: j.id, categoryId: organik.id });
  return j;
}

async function jemput(opsi: {
  tanggal: string;
  slotId: string;
  rutinId?: string | null;
  status?: "menunggu" | "dijemput" | "selesai" | "batal";
}) {
  const [p] = await db
    .insert(schema.pickups)
    .values({
      code: `PY-${2000 + n++}`,
      userId: WARGA,
      addressId: alamat.id,
      pickupDate: opsi.tanggal,
      timeSlotId: opsi.slotId,
      status: opsi.status ?? "menunggu",
      recurringScheduleId: opsi.rutinId ?? null,
    })
    .returning();
  return p;
}

const BESOK = tanggalISO(1);

assert.deepEqual(
  await pengingatUntuk(db, BESOK),
  [],
  "belum ada jadwal → tidak ada pengingat",
);
lulus("tanpa jadwal rutin → tidak ada pengingat");

/* --- jalur normal --- */
const rutinPagi = await jadwal({ slotId: pagi.id });
const sahih = await jemput({
  tanggal: BESOK,
  slotId: pagi.id,
  rutinId: rutinPagi.id,
});

let hasil = await pengingatUntuk(db, BESOK);
assert.equal(hasil.length, 1);
assert.equal(hasil[0].pickupId, sahih.id);
assert.equal(hasil[0].nama, "Bu Rina");
assert.equal(hasil[0].nomor, "0811");
assert.equal(hasil[0].jam, "06.00–08.00");
assert.equal(hasil[0].alamatLengkap, "Jl. Kenanga No. 12");
assert.deepEqual(hasil[0].jenis, ["organik"]);
lulus("jemput rutin besok → satu pengingat lengkap dengan kontak & jam");

/* --- bawaan tanpa argumen = besok --- */
assert.equal(
  (await pengingatUntuk(db)).length,
  1,
  "tanpa argumen tanggal, yang dihitung adalah besok",
);
lulus("tanpa argumen tanggal → memakai besok");

/* --- yang harus dilewati --- */
await jemput({ tanggal: BESOK, slotId: sore.id });
hasil = await pengingatUntuk(db, BESOK);
assert.equal(hasil.length, 1, "jemput satuan tidak diingatkan");
lulus("jemput satuan (bukan dari jadwal rutin) dilewati");

for (const s of ["dijemput", "selesai", "batal"] as const) {
  await klien.exec(`update pickups set status = '${s}' where id = '${sahih.id}'`);
  assert.deepEqual(
    await pengingatUntuk(db, BESOK),
    [],
    `status ${s} tidak perlu pengingat`,
  );
}
await klien.exec(
  `update pickups set status = 'menunggu' where id = '${sahih.id}'`,
);
lulus("status dijemput/selesai/batal dilewati");

await klien.exec(
  `update recurring_schedules set reminder_enabled = false where id = '${rutinPagi.id}'`,
);
assert.deepEqual(await pengingatUntuk(db, BESOK), []);
await klien.exec(
  `update recurring_schedules set reminder_enabled = true where id = '${rutinPagi.id}'`,
);
lulus("pengingat dimatikan warga → dilewati");

/* --- jeda: inti task ini --- */
await klien.exec(
  `update recurring_schedules set is_paused = true, paused_until = null
   where id = '${rutinPagi.id}'`,
);
assert.deepEqual(
  await pengingatUntuk(db, BESOK),
  [],
  "jeda tanpa batas melewati semua tanggal",
);
lulus("jadwal dijeda tanpa batas → dilewati");

/* Jeda berbatas: tanggal DI DALAM rentang dilewati, SETELAHNYA tidak. */
await klien.exec(
  `update recurring_schedules set paused_until = '${tanggalISO(3)}'
   where id = '${rutinPagi.id}'`,
);
assert.deepEqual(
  await pengingatUntuk(db, BESOK),
  [],
  "besok masih di dalam rentang jeda",
);
lulus("jeda berbatas, tanggal di dalam rentang → dilewati");

const sesudahJeda = await jemput({
  tanggal: tanggalISO(5),
  slotId: pagi.id,
  rutinId: rutinPagi.id,
});
hasil = await pengingatUntuk(db, tanggalISO(5));
assert.equal(hasil.length, 1, "setelah jeda berakhir, pengingat jalan lagi");
assert.equal(hasil[0].pickupId, sesudahJeda.id);
lulus("jeda berbatas, tanggal setelah jeda → TETAP diingatkan");

/* Tepat di hari terakhir jeda masih dilewati — jedanya inklusif. */
await jemput({
  tanggal: tanggalISO(3),
  slotId: pagi.id,
  rutinId: rutinPagi.id,
});
assert.deepEqual(
  await pengingatUntuk(db, tanggalISO(3)),
  [],
  "hari terakhir jeda masih terhitung dijeda",
);
lulus("hari terakhir jeda masih dilewati (rentang inklusif)");

await klien.exec(
  `update recurring_schedules set is_paused = false, paused_until = null
   where id = '${rutinPagi.id}'`,
);

/* --- masa berlaku jadwal --- */
await klien.exec(
  `update recurring_schedules set start_date = '${tanggalISO(2)}'
   where id = '${rutinPagi.id}'`,
);
assert.deepEqual(
  await pengingatUntuk(db, BESOK),
  [],
  "jadwal belum mulai besok",
);
await klien.exec(
  `update recurring_schedules
   set start_date = '${tanggalISO(-30)}', end_date = '${tanggalISO(-1)}'
   where id = '${rutinPagi.id}'`,
);
assert.deepEqual(
  await pengingatUntuk(db, BESOK),
  [],
  "jadwal sudah berakhir sebelum besok",
);
lulus("jadwal belum mulai / sudah berakhir → dilewati");

/* --- urutan: jam lebih pagi lebih dulu --- */
await klien.exec(`update recurring_schedules set end_date = null`);
const rutinSore = await jadwal({ slotId: sore.id });
await jemput({ tanggal: BESOK, slotId: sore.id, rutinId: rutinSore.id });
hasil = await pengingatUntuk(db, BESOK);
assert.deepEqual(
  hasil.map((p) => p.jam),
  ["06.00–08.00", "17.00–19.00"],
  "pengingat diurut menurut jam jemput",
);
lulus("dua pengingat di hari sama terurut menurut jam");

await klien.close();
console.log("\nSemua pemeriksaan service pengingat lulus.");
