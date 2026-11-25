/** Jalankan: npx tsx src/lib/faq.test.ts */
import assert from "node:assert/strict";
import { cariFaq, FAQ } from "./mock";

assert.equal(cariFaq("").length, FAQ.length);
assert.equal(cariFaq("   ").length, FAQ.length);
/* Huruf besar/kecil tidak berpengaruh. */
assert.ok(cariFaq("QRIS").length >= 1);
/* Semua kata kunci harus cocok — menyempit, bukan melebar. */
assert.deepEqual(
  cariFaq("bayar qris").map((f) => f.tanya),
  ["Pembayaran apa saja yang diterima?"],
);
assert.equal(cariFaq("zzz").length, 0);

console.log("faq: semua lolos");
