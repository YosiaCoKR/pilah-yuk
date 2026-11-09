/** Jalankan: npm run test:akun */
import assert from "node:assert/strict";
import { normalkanHp, periksaPendaftaran } from "./akun";
import { HP_TERDAFTAR } from "./mock";

/* Semua cara menulis satu nomor harus jatuh ke bentuk yang sama, kalau tidak
   nomor yang sudah terdaftar lolos lewat format lain. */
assert.equal(normalkanHp("+62 812-3456-7890"), "081234567890");
assert.equal(normalkanHp("6281234567890"), "081234567890");
assert.equal(normalkanHp("0812 3456 7890"), "081234567890");

const sah = { nama: "Siti", hp: "0813 1111 2222", sandi: "rahasia123" };
assert.deepEqual(periksaPendaftaran(sah, HP_TERDAFTAR), {});

const kosong = periksaPendaftaran({ nama: "", hp: "", sandi: "" });
assert.ok(kosong.nama && kosong.hp && kosong.sandi);

assert.ok(periksaPendaftaran({ ...sah, nama: "Si" }).nama);
assert.ok(periksaPendaftaran({ ...sah, hp: "0212345678" }).hp);
assert.ok(periksaPendaftaran({ ...sah, hp: "0812" }).hp);
assert.ok(periksaPendaftaran({ ...sah, sandi: "pendek1" }).sandi);

/* Nomor terdaftar ditolak apa pun formatnya. */
assert.ok(
  periksaPendaftaran({ ...sah, hp: "+62 812-3456-7890" }, HP_TERDAFTAR).hp,
);
/* Tanpa daftar pembanding, nomor yang sama justru harus lolos. */
assert.deepEqual(periksaPendaftaran({ ...sah, hp: "081234567890" }), {});

console.log("akun: semua pemeriksaan lulus");
