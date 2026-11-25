/** Jalankan: npm run test:bantuan */
import assert from "node:assert/strict";
import { isiData } from "../db/seed";
import { lulus, siapkan } from "../test/bantu";

const { klien, db, panggil } = await siapkan();
const { faq } = await isiData(db);
const W = "11111111-1111-1111-1111-111111111111";
const cari = (kata?: string) =>
  panggil(
    "GET",
    kata === undefined
      ? "/api/bantuan"
      : `/api/bantuan?kata=${encodeURIComponent(kata)}`,
    { sebagai: W },
  );

assert.equal((await panggil("GET", "/api/bantuan")).status, 401);
lulus("tanpa identitas → 401");

let r = await cari();
assert.equal(r.body.data.length, faq);
assert.equal(r.body.data[0].tanya, "Jam berapa petugas datang?", "urut tampil");
lulus(`tanpa kata → semua ${faq} FAQ, urut tampil`);

r = await cari("QRIS");
assert.ok(r.body.data.length >= 1, "huruf besar/kecil tidak berpengaruh");
r = await cari("bayar   qris");
assert.deepEqual(
  r.body.data.map((f: any) => f.tanya),
  ["Pembayaran apa saja yang diterima?"],
  "semua kata kunci harus cocok",
);
lulus("beberapa kata kunci menyempitkan hasil, tanpa peduli huruf besar");

r = await cari("100%");
assert.deepEqual(r.body.data, [], "% harus dicocokkan harfiah");
r = await cari("x".repeat(61));
assert.equal(r.status, 422);
lulus("% dikawal, kata > 60 huruf → 422");

await klien.close();
console.log("\nSemua pemeriksaan API pusat bantuan lulus.");
