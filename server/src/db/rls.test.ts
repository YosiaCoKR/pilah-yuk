/**
 * Membuktikan jalur Realtime penjemputan: apa yang disiarkan, dan untuk siapa.
 *
 * Yang diuji adalah jalur yang TIDAK lewat API: koneksi dengan peran
 * `authenticated` — seperti Supabase Realtime dan PostgREST — yang di
 * produksi hanya ditahan oleh kebijakan ini.
 *
 * Jalankan: npm run test:rls
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { lulus, siapkan } from "../test/bantu";

const { klien, db, schema } = await siapkan();

const RINA = "11111111-1111-1111-1111-111111111111";
const AGUS = "22222222-2222-2222-2222-222222222222";
await db.insert(schema.users).values([
  { id: RINA, fullName: "Bu Rina", phone: "0811" },
  { id: AGUS, fullName: "Pak Agus", phone: "0822" },
]);

const [slot] = await db
  .insert(schema.timeSlots)
  .values({ label: "06.00–08.00", startTime: "06:00:00", endTime: "08:00:00" })
  .returning();
const [organik] = await db
  .insert(schema.wasteCategories)
  .values({ slug: "organik", name: "Organik" })
  .returning();

async function punyaWarga(userId: string, alamat: string) {
  const [a] = await db
    .insert(schema.addresses)
    .values({ userId, label: "Rumah", fullAddress: alamat })
    .returning();
  const [p] = await db
    .insert(schema.pickups)
    .values({
      code: `PY-${userId.slice(0, 4)}`,
      userId,
      addressId: a.id,
      pickupDate: "2026-11-03",
      timeSlotId: slot.id,
    })
    .returning();
  await db
    .insert(schema.pickupItems)
    .values({ pickupId: p.id, categoryId: organik.id });
  return p;
}

const milikRina = await punyaWarga(RINA, "Jl. Kenanga No. 12");
const milikAgus = await punyaWarga(AGUS, "Jl. Melati No. 4");

/** Jalankan query sebagai warga tertentu lewat peran `authenticated`. */
async function sebagai<T>(userId: string | null, sql: string): Promise<T[]> {
  await klien.exec("begin");
  try {
    await klien.exec("set local role authenticated");
    await klien.query(`select set_config('request.jwt.claim.sub', $1, true)`, [
      userId,
    ]);
    const r = await klien.query<T>(sql);
    return r.rows;
  } finally {
    await klien.exec("rollback");
  }
}

/* --- koneksi API (pemilik tabel) tetap melihat semuanya --- */
const semua = await db.select().from(schema.pickups);
assert.equal(semua.length, 2, "koneksi service role tidak dibatasi RLS");
lulus("koneksi API (service role) tetap melihat semua penjemputan");

/* --- warga hanya melihat miliknya --- */
const barisRina = await sebagai<{ id: string }>(
  RINA,
  "select id from pickups",
);
assert.deepEqual(
  barisRina.map((b) => b.id),
  [milikRina.id],
  "Bu Rina hanya boleh melihat penjemputannya",
);
lulus("warga hanya melihat penjemputan miliknya");

const barisAgus = await sebagai<{ id: string }>(AGUS, "select id from pickups");
assert.deepEqual(barisAgus.map((b) => b.id), [milikAgus.id]);
lulus("warga lain melihat miliknya sendiri, bukan milik tetangga");

/* Menyebut id orang lain secara langsung pun tetap kosong — kebijakan
   menyaring baris, bukan mengandalkan WHERE si pemanggil. */
const nekat = await sebagai<{ id: string }>(
  RINA,
  `select id from pickups where id = '${milikAgus.id}'`,
);
assert.deepEqual(nekat, [], "menyebut id tetangga langsung tetap tidak terbaca");
lulus("menyebut id penjemputan tetangga langsung → kosong");

/* --- tanpa identitas: tidak ada baris --- */
const tanpaSiapa = await sebagai<{ id: string }>(
  null,
  "select id from pickups",
);
assert.deepEqual(tanpaSiapa, [], "tanpa auth.uid() tidak ada yang terbaca");
lulus("tanpa identitas (auth.uid() null) → tidak ada baris");

/* --- rincian jenis ikut induknya --- */
const itemRina = await sebagai<{ pickup_id: string }>(
  RINA,
  "select pickup_id from pickup_items",
);
assert.deepEqual(
  itemRina.map((b) => b.pickup_id),
  [milikRina.id],
  "rincian jenis milik tetangga tidak boleh terbaca",
);
lulus("rincian jenis sampah ikut kebijakan induknya");

/* --- menulis tetap tertutup bagi warga --- */
await assert.rejects(
  () =>
    sebagai(
      RINA,
      `insert into pickups (code, user_id, address_id, pickup_date, time_slot_id)
       values ('PY-9999', '${RINA}', '${milikRina.addressId}', '2026-12-01', '${slot.id}')`,
    ),
  "warga tidak boleh menyisipkan penjemputan langsung ke tabel",
);
/* UPDATE tidak melempar galat: tanpa kebijakan UPDATE, RLS membuat barisnya
   tidak terlihat untuk diubah, jadi yang terjadi adalah NOL baris berubah.
   Yang dipastikan di sini: statusnya benar-benar tidak bergeser. */
const diubah = await sebagai<{ id: string }>(
  RINA,
  `update pickups set status = 'batal' returning id`,
);
assert.deepEqual(diubah, [], "tidak ada baris yang bisa diubah warga");
const [tetap] = await db
  .select({ status: schema.pickups.status })
  .from(schema.pickups)
  .where(eq(schema.pickups.id, milikRina.id));
assert.equal(tetap.status, "menunggu", "status tidak bergeser");
lulus("warga tidak bisa menulis langsung — menulis harus lewat API");

/* --- yang boleh disiarkan Realtime --------------------------------------- */

/* Dua pemeriksaan di bawah menjaga migrasi `0003_realtime_penjemputan`. Kalau
   salah satunya jebol, gejalanya di layar warga sama persis: status diam saja —
   dan tidak ada galat di mana pun yang menunjuk ke sini. */

const [replika] = await klien
  .query<{ relreplident: string }>(
    "select relreplident from pg_class where relname = 'pickups'",
  )
  .then((r) => r.rows);
assert.equal(
  replika.relreplident,
  "f",
  "tanpa REPLICA IDENTITY FULL, UPDATE hanya mengirim kunci primer: RLS tidak bisa diuji dan saringan id tidak pernah cocok",
);
lulus("pickups memakai REPLICA IDENTITY FULL");

const disiarkan = await klien
  .query<{ tablename: string }>(
    `select tablename from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'`,
  )
  .then((r) => r.rows.map((b) => b.tablename).sort());
assert.ok(
  disiarkan.includes("pickups"),
  "pickups harus masuk publikasi supabase_realtime",
);
/* Sengaja hanya pickups: `users` memuat nomor HP seluruh warga, dan publikasi
   yang terlalu luas menyiarkannya ke tiap pelanggan Realtime. */
assert.deepEqual(disiarkan, ["pickups"], "hanya pickups yang disiarkan");
lulus("hanya pickups yang masuk publikasi Realtime — users tidak ikut");

/* --- daftar anggota channel ----------------------------------------------- */

/* Bagian paling rapuh dari kebijakan channel_members: ia perlu membaca
   channel_members. Lewat sub-query biasa Postgres menolaknya sebagai rekursi
   tak berujung, jadi dipakai `ikut_channel()` yang SECURITY DEFINER. Query di
   bawah yang berhasil KEMBALI — bukan hanya kembali kosong — itulah buktinya. */

const BUDI = "33333333-3333-3333-3333-333333333333";
await db
  .insert(schema.users)
  .values({ id: BUDI, fullName: "Pak Budi", phone: "0833" });

const [channel] = await db
  .insert(schema.rwChannels)
  .values({ name: "RW 05 Sukamaju", areaCode: "3573" })
  .returning();

await db.insert(schema.channelMembers).values([
  { channelId: channel.id, userId: RINA, status: "aktif", isPengurus: true },
  { channelId: channel.id, userId: AGUS, status: "aktif" },
  /* Sudah mengajukan, belum disetujui — belum boleh melihat daftar warga. */
  { channelId: channel.id, userId: BUDI, status: "menunggu" },
]);

const dilihatRina = await sebagai<{ user_id: string }>(
  RINA,
  "select user_id from channel_members",
);
assert.deepEqual(
  dilihatRina.map((b) => b.user_id).sort(),
  [RINA, AGUS, BUDI].sort(),
  "anggota aktif melihat seluruh daftar anggota channel-nya",
);
lulus("anggota aktif melihat daftar anggota channel-nya (tanpa galat rekursi)");

const dilihatBudi = await sebagai<{ user_id: string }>(
  BUDI,
  "select user_id from channel_members",
);
assert.deepEqual(
  dilihatBudi.map((b) => b.user_id),
  [BUDI],
  "yang masih menunggu hanya melihat pengajuannya sendiri",
);
lulus("masih menunggu → hanya melihat barisnya sendiri, bukan daftar warga");

/* Warga di luar channel: nama dan rumah tetangga satu RW bukan data publik. */
const LUAR = "44444444-4444-4444-4444-444444444444";
await db
  .insert(schema.users)
  .values({ id: LUAR, fullName: "Bu Tini", phone: "0844" });
const dilihatLuar = await sebagai<{ user_id: string }>(
  LUAR,
  "select user_id from channel_members",
);
assert.deepEqual(dilihatLuar, [], "bukan anggota → tidak ada daftar anggota");
lulus("bukan anggota channel → daftar anggotanya tidak terbaca");

await klien.close();
console.log("\nSemua pemeriksaan RLS penjemputan lulus.");
