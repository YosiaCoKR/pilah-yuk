/** Jalankan: npx tsx src/lib/toko-ulasan.test.ts */
import assert from "node:assert/strict";
import { ULASAN } from "./mock";
import { tambahUlasan } from "./toko-ulasan";

const baru = {
  pickupId: "pk-2",
  nilai: 4 as const,
  tanda: [],
  catatan: "",
  dikirim: "2026-10-27",
};

const sekali = tambahUlasan(ULASAN, baru);
assert.equal(sekali?.length, ULASAN.length + 1);

/* Kiriman kedua untuk jemput yang sama ditolak, bukan ditimpa/digandakan. */
assert.equal(tambahUlasan(sekali!, { ...baru, nilai: 1 }), null);
assert.equal(tambahUlasan(ULASAN, { ...baru, pickupId: "pk-3" }), null);

console.log("toko-ulasan: semua lolos");
