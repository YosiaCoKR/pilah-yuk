/** Jalankan: npm run test:channel */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { lulus, siapkan } from "../test/bantu";

const { klien, db, panggil, schema } = await siapkan();

const RINA = "11111111-1111-1111-1111-111111111111";
const HENDRA = "22222222-2222-2222-2222-222222222222";
const BUDI = "33333333-3333-3333-3333-333333333333";
await db.insert(schema.users).values([
  { id: RINA, fullName: "Bu Rina", phone: "0811" },
  { id: HENDRA, fullName: "Pak Hendra", phone: "0822" },
  { id: BUDI, fullName: "Pak Budi", phone: "0833" },
]);

/* Rumah Bu Rina. Titik-titik di bawah dipilih supaya urutan jaraknya jelas:
   RW 05 ~110 m, RW 06 ~1,1 km, RW 02 ~3,3 km. */
const RUMAH = { lat: "-7.250000", lng: "112.750000" };

const [rw05] = await db
  .insert(schema.rwChannels)
  .values({
    name: "RW 05 Sukamaju",
    rtNumber: "03",
    rwNumber: "05",
    kelurahan: "Sukamaju",
    areaCode: "3573",
    latitude: "-7.251000",
    longitude: "112.750000",
  })
  .returning();
const [rw06] = await db
  .insert(schema.rwChannels)
  .values({
    name: "RW 06 Sukamaju",
    kelurahan: "Sukamaju",
    areaCode: "3573",
    latitude: "-7.260000",
    longitude: "112.750000",
  })
  .returning();
const [rw02] = await db
  .insert(schema.rwChannels)
  .values({
    name: "RW 02 Mekarsari",
    kelurahan: "Mekarsari",
    areaCode: "3573",
    latitude: "-7.280000",
    longitude: "112.750000",
  })
  .returning();
/* Channel tanpa titik: harus tetap muncul, hanya di urutan paling bawah. */
const [rwTanpaTitik] = await db
  .insert(schema.rwChannels)
  .values({ name: "RW 09 Mekarsari", kelurahan: "Mekarsari", areaCode: "3573" })
  .returning();

const [pagi] = await db
  .insert(schema.timeSlots)
  .values({ label: "06.00–08.00", startTime: "06:00:00", endTime: "08:00:00" })
  .returning();
await db
  .insert(schema.channelSchedules)
  .values({ channelId: rw05.id, timeSlotId: pagi.id, days: [2, 5] });

await db.insert(schema.channelMembers).values([
  { channelId: rw05.id, userId: HENDRA, status: "aktif", isPengurus: true },
  { channelId: rw05.id, userId: BUDI, status: "aktif" },
  /* Menunggu — tidak boleh ikut terhitung sebagai anggota. */
  { channelId: rw05.id, userId: RINA, status: "menunggu" },
]);

const LUAR = "44444444-4444-4444-4444-444444444444";
await db
  .insert(schema.users)
  .values({ id: LUAR, fullName: "Bu Tini", phone: "0844" });

let r = await panggil("GET", "/api/channel");
assert.equal(r.status, 401);
lulus("tanpa identitas → 401");

/* --- belum ada titik alamat --- */
r = await panggil("GET", "/api/channel", { sebagai: RINA });
assert.equal(r.status, 200);
assert.equal(r.body.titikAlamatAda, false, "alamat Bu Rina belum ditandai");
assert.ok(
  r.body.data.every((c: { jarakM: number | null }) => c.jarakM === null),
  "tanpa titik alamat, jarak null — bukan 0",
);
assert.equal(r.body.data.length, 4, "semua channel tetap terdaftar");
lulus("tanpa titik alamat → daftar tetap utuh, jarak null bukan nol");

/* --- dengan titik alamat --- */
await db.insert(schema.addresses).values({
  userId: RINA,
  label: "Rumah",
  fullAddress: "Jl. Kenanga No. 12",
  rwChannelId: rw05.id,
  isDefault: true,
  latitude: RUMAH.lat,
  longitude: RUMAH.lng,
});

r = await panggil("GET", "/api/channel", { sebagai: RINA });
assert.equal(r.body.titikAlamatAda, true);
const urut = r.body.data.map((c: { id: string }) => c.id);
assert.deepEqual(
  urut,
  [rw05.id, rw06.id, rw02.id, rwTanpaTitik.id],
  "yang diikuti dulu, lalu terdekat, yang tanpa titik paling bawah",
);
lulus("terurut: channel sendiri dulu, lalu terdekat, tanpa titik di bawah");

const dekat = r.body.data[0];
assert.ok(
  dekat.jarakM > 80 && dekat.jarakM < 150,
  `RW 05 ~110 m, dapat ${dekat.jarakM}`,
);
assert.ok(
  r.body.data[1].jarakM > 1000 && r.body.data[1].jarakM < 1250,
  `RW 06 ~1,1 km, dapat ${r.body.data[1].jarakM}`,
);
assert.equal(r.body.data[3].jarakM, null, "tanpa titik → jarak null");
lulus("jarak terhitung dalam meter & naik sesuai urutan");

/* --- keanggotaan: menunggu bukan anggota --- */
assert.equal(dekat.statusKeanggotaan, "menunggu");
assert.equal(dekat.isMember, false, "menunggu belum jadi anggota");
assert.equal(dekat.isManager, false);
assert.equal(dekat.memberCount, 2, "yang menunggu tidak ikut dihitung");
assert.equal(dekat.pengurus, "Pak Hendra");
assert.deepEqual(
  dekat.jadwal,
  [{ days: [2, 5], jam: "06.00–08.00" }],
  "jadwal angkut terstruktur, kalimatnya dirakit di layar",
);
assert.deepEqual(
  r.body.data.find((c: { id: string }) => c.id === rw06.id).jadwal,
  [],
  "channel tanpa jadwal → array kosong, bukan null",
);
assert.equal(dekat.kelurahan, "Sukamaju");
lulus("menunggu ≠ anggota; jumlah anggota & nama pengurus terbaca");

r = await panggil("GET", "/api/channel", { sebagai: HENDRA });
const milikHendra = r.body.data.find((c: { id: string }) => c.id === rw05.id);
assert.equal(milikHendra.isMember, true);
assert.equal(milikHendra.isManager, true, "pengurus channel-nya sendiri");
const bukanMilikHendra = r.body.data.find(
  (c: { id: string }) => c.id === rw06.id,
);
assert.equal(bukanMilikHendra.statusKeanggotaan, null);
assert.equal(bukanMilikHendra.isManager, false);
lulus("pengurus ditandai hanya di channel yang ia urus");

/* --- pencarian --- */
r = await panggil("GET", "/api/channel?q=mekarsari", { sebagai: RINA });
assert.deepEqual(
  r.body.data.map((c: { id: string }) => c.id),
  [rw02.id, rwTanpaTitik.id],
  "cari kelurahan, huruf besar-kecil diabaikan",
);
lulus("cari per kelurahan, tidak peduli huruf besar-kecil");

r = await panggil("GET", "/api/channel?q=RW 06", { sebagai: RINA });
assert.deepEqual(r.body.data.map((c: { id: string }) => c.id), [rw06.id]);
r = await panggil("GET", "/api/channel?q=3573", { sebagai: RINA });
assert.equal(r.body.data.length, 4, "kode wilayah mencocokkan seluruhnya");
r = await panggil("GET", "/api/channel?q=tidak-ada", { sebagai: RINA });
assert.deepEqual(r.body.data, []);
lulus("cari per nama & kode wilayah; tanpa hasil → daftar kosong");

/* --- gabung --- */
r = await panggil("POST", `/api/channel/${rw06.id}/gabung`);
assert.equal(r.status, 401);

r = await panggil(
  "POST",
  "/api/channel/00000000-0000-0000-0000-000000000000/gabung",
  { sebagai: RINA },
);
assert.equal(r.status, 404);
r = await panggil("POST", "/api/channel/bukan-uuid/gabung", { sebagai: RINA });
assert.equal(r.status, 422);
lulus("gabung: tanpa identitas 401, channel asing 404, id ngawur 422");

r = await panggil("POST", `/api/channel/${rw06.id}/gabung`, { sebagai: RINA });
assert.equal(r.status, 201);
assert.equal(
  r.body.data.status,
  "menunggu",
  "gabung tidak langsung aktif — pengurus yang memutuskan",
);
assert.match(r.body.pesan, /RW 06/);
lulus("gabung → 201 berstatus menunggu, bukan langsung aktif");

/* Jumlah anggota tidak boleh naik karena ada yang mengajukan. */
r = await panggil("GET", "/api/channel", { sebagai: RINA });
const rw06Baru = r.body.data.find((c: { id: string }) => c.id === rw06.id);
assert.equal(rw06Baru.statusKeanggotaan, "menunggu");
assert.equal(rw06Baru.isMember, false);
assert.equal(rw06Baru.memberCount, 0);
lulus("pengajuan terlihat di daftar tanpa menaikkan jumlah anggota");

/* Mengajukan dua kali bukan baris kedua. */
r = await panggil("POST", `/api/channel/${rw06.id}/gabung`, { sebagai: RINA });
assert.equal(r.status, 409);
assert.equal(r.body.data.status, "menunggu");
assert.match(r.body.pesan, /menunggu persetujuan/i);
const [{ n }] = await klien
  .query<{ n: number }>(
    `select count(*)::int as n from channel_members
     where channel_id = '${rw06.id}' and user_id = '${RINA}'`,
  )
  .then((x) => x.rows);
assert.equal(n, 1, "tidak ada baris keanggotaan kedua");
lulus("mengajukan dua kali → 409, tetap satu baris");

/* Sudah aktif: pesannya berbeda, supaya layar tidak bilang "menunggu". */
r = await panggil("POST", `/api/channel/${rw05.id}/gabung`, { sebagai: BUDI });
assert.equal(r.status, 409);
assert.equal(r.body.data.status, "aktif");
assert.match(r.body.pesan, /sudah jadi anggota/i);
lulus("anggota aktif yang mengajukan lagi → 409 dengan pesan yang tepat");

/* --- detail channel ------------------------------------------------------- */

/* Pak Hendra pengurus RW 05 dan menulis dua pengumuman. */
await db
  .update(schema.channelMembers)
  .set({ jabatan: "Ketua RW 05" })
  .where(eq(schema.channelMembers.userId, HENDRA));

await db.insert(schema.channelPosts).values([
  {
    channelId: rw05.id,
    authorId: HENDRA,
    title: "Kantong organik dibagikan",
    content: "Ambil di balai RW tiap Sabtu pagi.",
    createdAt: new Date(Date.now() - 9 * 86_400_000),
  },
  {
    channelId: rw05.id,
    authorId: HENDRA,
    title: "Truk Jumat lebih pagi",
    content: "Mohon karung sudah di depan pagar sebelum 06.00.",
    createdAt: new Date(Date.now() - 2 * 86_400_000),
  },
]);

r = await panggil("GET", `/api/channel/${rw05.id}`);
assert.equal(r.status, 401);
r = await panggil("GET", "/api/channel/00000000-0000-0000-0000-000000000000", {
  sebagai: RINA,
});
assert.equal(r.status, 404);
lulus("detail: tanpa identitas 401, channel asing 404");

/* Bukan anggota (Bu Rina masih menunggu di RW 05): jadwal boleh, pengumuman
   tidak — itulah yang dibacanya sebelum memutuskan gabung. */
r = await panggil("GET", `/api/channel/${rw05.id}`, { sebagai: RINA });
assert.equal(r.status, 200);
assert.deepEqual(r.body.data.jadwal, [{ days: [2, 5], jam: "06.00–08.00" }]);
assert.equal(r.body.data.memberCount, 2);
assert.equal(r.body.data.pengurus, "Pak Hendra");
assert.ok(r.body.data.jarakM > 80 && r.body.data.jarakM < 150);
assert.equal(r.body.data.isMember, false);
assert.equal(r.body.data.pengumumanTerbaru, null, "bukan anggota → tanpa pengumuman");
assert.equal(r.body.data.jumlahPengumuman, 0, "jumlahnya pun tidak dibocorkan");
assert.equal(r.body.data.menungguPersetujuan, null, "angka pengurus tidak bocor");
lulus("bukan anggota: jadwal & info terbaca, pengumuman tidak");

/* Anggota aktif: pengumuman terbaru yang muncul, bukan yang pertama ditulis. */
r = await panggil("GET", `/api/channel/${rw05.id}`, { sebagai: BUDI });
assert.equal(r.body.data.isMember, true);
assert.equal(r.body.data.isManager, false);
assert.equal(r.body.data.jumlahPengumuman, 2);
assert.equal(r.body.data.pengumumanTerbaru.title, "Truk Jumat lebih pagi");
assert.equal(r.body.data.pengumumanTerbaru.author, "Pak Hendra");
assert.equal(r.body.data.pengumumanTerbaru.authorRole, "Ketua RW 05");
assert.equal(r.body.data.menungguPersetujuan, null, "anggota biasa bukan pengurus");
lulus("anggota: pengumuman TERBARU yang tampil, lengkap dengan jabatan penulis");

/* Pengurus: ditambah antrean persetujuan — Bu Rina masih menunggu. */
r = await panggil("GET", `/api/channel/${rw05.id}`, { sebagai: HENDRA });
assert.equal(r.body.data.isManager, true);
assert.equal(r.body.data.menungguPersetujuan, 1, "satu permintaan menunggu");
lulus("pengurus: antrean persetujuan terbaca");

/* Channel tanpa jadwal & tanpa pengumuman tidak boleh meledak. */
r = await panggil("GET", `/api/channel/${rwTanpaTitik.id}`, { sebagai: RINA });
assert.equal(r.status, 200);
assert.deepEqual(r.body.data.jadwal, []);
assert.equal(r.body.data.jarakM, null);
assert.equal(r.body.data.pengurus, null, "belum ada pengurus → null");
assert.equal(r.body.data.memberCount, 0);
lulus("channel kosong: jadwal [], jarak null, pengurus null");

/* --- daftar pengumuman ---------------------------------------------------- */

r = await panggil("GET", `/api/channel/${rw05.id}/pengumuman`);
assert.equal(r.status, 401);
r = await panggil(
  "GET",
  "/api/channel/00000000-0000-0000-0000-000000000000/pengumuman",
  { sebagai: BUDI },
);
assert.equal(r.status, 404);

/* Masih menunggu → 403 yang menjelaskan sebabnya, bukan 404 yang menyesatkan. */
r = await panggil("GET", `/api/channel/${rw05.id}/pengumuman`, { sebagai: RINA });
assert.equal(r.status, 403);
assert.match(r.body.pesan, /menunggu persetujuan/i);

/* Belum pernah mengajukan → 403 dengan arahan gabung. */
r = await panggil("GET", `/api/channel/${rw05.id}/pengumuman`, {
  sebagai: LUAR,
});
assert.equal(r.status, 403);
assert.match(r.body.pesan, /gabung channel/i);
lulus("pengumuman: menunggu & bukan anggota ditolak dengan sebab yang jelas");

r = await panggil("GET", `/api/channel/${rw05.id}/pengumuman`, { sebagai: BUDI });
assert.equal(r.status, 200);
assert.deepEqual(
  r.body.data.map((p: { title: string }) => p.title),
  ["Truk Jumat lebih pagi", "Kantong organik dibagikan"],
  "terbaru di atas",
);
lulus("anggota membaca seluruh pengumuman, terbaru di atas");

/* Pengurus yang pindah: pengumumannya tetap terbaca, penulisnya kosong. */
await db.delete(schema.users).where(eq(schema.users.id, HENDRA));
r = await panggil("GET", `/api/channel/${rw05.id}/pengumuman`, { sebagai: BUDI });
assert.equal(r.body.data.length, 2, "arsip pengumuman tidak ikut hilang");
assert.equal(r.body.data[0].author, null);
assert.equal(r.body.data[0].authorRole, null);
lulus("penulis dihapus → pengumumannya tetap ada, namanya kosong");

await klien.close();
console.log("\nSemua pemeriksaan API channel lulus.");
