/**
 * Menjalankan seed YANG SAMA dengan produksi di atas Postgres sementara.
 *
 * Bukan memeriksa ulang isi daftarnya satu-satu — yang diperiksa adalah
 * janji-janji yang dipegang layar panduan: urutannya disengaja, tiap jenis
 * punya cara menangani (sumber "tips hari ini"), tiap kartu jenis punya
 * contoh, dan "sering dikira" tidak pernah menunjuk tong sendiri. Satu baris
 * yang keliru di seed akan mencetak panduan yang salah di depan tong.
 *
 * Jalankan: npm run test:seed
 */
import assert from "node:assert/strict";
import { lulus, siapkan } from "../test/bantu";
import { isiData } from "./seed";
import { wasteCategories, wasteGuideItems } from "./schema";

const { db, klien } = await siapkan();

const n = await isiData(db);
assert.equal(n.kategori, 4);
assert.equal(n.benda, 32);
lulus(`seed jalan: ${n.kategori} jenis, ${n.benda} benda`);

/* Urutan panduan disengaja: campuran = belum terpilah, jadi tidak boleh
   memimpin daftar. Alfabet justru menaruhnya di baris pertama. */
const jenis = await db
  .select()
  .from(wasteCategories)
  .orderBy(wasteCategories.sortOrder);
assert.deepEqual(
  jenis.map((k) => k.slug),
  ["organik", "plastik", "kertas", "campuran"],
);
lulus("urutan jenis: organik → plastik → kertas → campuran");

/* `handling_tip` tiap jenis adalah sumber separuh "tips hari ini"; satu yang
   kosong membuat tip hari itu jadi kartu tanpa kalimat. */
for (const k of jenis) {
  assert.ok(k.name, `${k.slug}: nama kosong`);
  assert.ok(k.description, `${k.slug}: deskripsi kosong`);
  assert.ok(
    k.handlingTip,
    `${k.slug}: handling_tip kosong — tips harian pincang`,
  );
}
lulus("tiap jenis punya nama, deskripsi, dan cara menangani");

const benda = await db.select().from(wasteGuideItems);
const perJenis = new Map(jenis.map((k) => [k.id, k.slug]));

/* Kartu jenis di halaman panduan mencetak contoh dari benda yang disorot.
   Jenis tanpa satu pun sorot tampil sebagai kartu tanpa contoh. */
for (const k of jenis) {
  const sorot = benda.filter((b) => b.categoryId === k.id && b.isHighlighted);
  assert.ok(sorot.length > 0, `${k.slug}: tidak ada benda tersorot`);
}
lulus("tiap jenis punya contoh tersorot untuk kartunya");

/* Nama dipakai sebagai kunci pencarian DAN kunci upsert, jadi huruf kecil &
   tanpa spasi menggantung bukan soal gaya. */
for (const b of benda) {
  assert.equal(
    b.name,
    b.name.toLowerCase().trim(),
    `"${b.name}" bukan huruf kecil rapi`,
  );
  assert.ok(perJenis.has(b.categoryId), `"${b.name}": jenis tidak dikenal`);
  if (b.mistakenForId) {
    assert.ok(
      perJenis.has(b.mistakenForId),
      `"${b.name}": tong salah-kira tidak dikenal`,
    );
    assert.notEqual(
      b.mistakenForId,
      b.categoryId,
      `"${b.name}": sering dikira masuk tongnya sendiri`,
    );
  }
}
lulus("nama benda rapi; salah-kira menunjuk tong lain yang nyata");

/* Separuh tips berangkat dari catatan benda. Nol catatan = tips harian cuma
   berputar di 4 kalimat cara menangani. */
const bercatatan = benda.filter((b) => b.note).length;
assert.ok(bercatatan >= 8, `cuma ${bercatatan} benda punya catatan`);
lulus(
  `${jenis.length + bercatatan} tip bisa dirakit (4 jenis + ${bercatatan} catatan)`,
);

/* Dijalankan dua kali: data acuan ini ikut setiap deploy. Yang kedua harus
   MEMPERBARUI, bukan menambah baris kedua — dan bukan pula gagal. */
await isiData(db);
const ulang = await db.select().from(wasteGuideItems);
assert.equal(ulang.length, benda.length, "seed kedua menggandakan benda");
assert.equal(
  (await db.select().from(wasteCategories)).length,
  4,
  "seed kedua menggandakan jenis",
);
lulus("aman dijalankan berulang: memperbarui, bukan menggandakan");

/* Kalimat yang diperbaiki harus benar-benar sampai ke warga — kalau seed
   melewati baris yang sudah ada, perbaikan panduan tidak pernah terbit. */
const sebelum = ulang.find((b) => b.name === "styrofoam")!;
await db
  .update(wasteGuideItems)
  .set({ note: "catatan basi", isHighlighted: false });
await isiData(db);
const segar = await db.select().from(wasteGuideItems);
const sesudah = segar.find((b) => b.name === "styrofoam")!;
assert.equal(sesudah.note, sebelum.note, "catatan basi tidak ikut diperbarui");
assert.ok(
  segar.some((b) => b.isHighlighted),
  "sorot tidak ikut diperbarui",
);
lulus("seed memperbaiki baris lama, bukan melewatinya");

await klien.close();
console.log("\nSemua pemeriksaan seed data panduan lulus.");
