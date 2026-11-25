/** Jalankan: npm run test:profil */
import assert from "node:assert/strict";
import { periksaProfil } from "./akun";
import { ADDRESSES } from "./mock";
import { buangAlamat, gantiAlamat } from "./toko-profil";

const utama = (xs: typeof ADDRESSES) =>
  xs.filter((a) => a.isDefault).map((a) => a.id);

/* Menandai alamat lain sebagai utama memindahkan tanda, bukan menambah. */
assert.deepEqual(
  utama(gantiAlamat(ADDRESSES, { ...ADDRESSES[2], isDefault: true })),
  ["addr-3"],
);

/* Menghapus alamat utama tidak menyisakan nol alamat utama. */
assert.deepEqual(utama(buangAlamat(ADDRESSES, "addr-1")), ["addr-2"]);

/* Alamat baru tanpa centang utama tidak merebut tanda yang sudah ada. */
const tambah = gantiAlamat(ADDRESSES, { ...ADDRESSES[1], id: "baru" });
assert.equal(tambah.length, 4);
assert.deepEqual(utama(tambah), ["addr-1"]);

assert.deepEqual(buangAlamat([ADDRESSES[0]], "addr-1"), []);

assert.deepEqual(
  periksaProfil({ nama: "Rina", hp: "+62 812 3456 7890", email: "" }),
  {},
);
const g = periksaProfil({ nama: "Ri", hp: "12345", email: "rina@" });
assert.ok(g.nama && g.hp && g.email);

console.log("toko-profil: semua lolos");
