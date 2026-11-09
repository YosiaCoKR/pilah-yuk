/** Jalankan: npm run test:akun */
import assert from "node:assert/strict";
import { normalkanHp, periksaMasuk, periksaPendaftaran } from "./akun";
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

/* Halaman masuk: aturan nomor harus identik dengan pendaftaran. */

const masukSah = { hp: "0812 3456 7890", sandi: "rahasia123" };
assert.deepEqual(periksaMasuk(masukSah, HP_TERDAFTAR), {});
/* Nomor terdaftar tetap dikenali walau ditulis dengan awalan +62. */
assert.deepEqual(
  periksaMasuk({ ...masukSah, hp: "+62 812-3456-7890" }, HP_TERDAFTAR),
  {},
);
/* Nomor yang belum punya akun ditolak — kalau tidak, warga baru terjebak di
   layar masuk tanpa tahu harus mendaftar. */
assert.ok(periksaMasuk({ ...masukSah, hp: "0899 0000 0000" }, HP_TERDAFTAR).hp);
assert.ok(periksaMasuk({ hp: "", sandi: "" }).hp);
assert.ok(periksaMasuk({ ...masukSah, sandi: "pendek1" }).sandi);
/* Tanpa daftar pembanding, pemeriksaan "belum terdaftar" harus diam. */
assert.deepEqual(periksaMasuk({ ...masukSah, hp: "0899 0000 0000" }), {});

console.log("masuk: semua pemeriksaan lulus");

