/** Jalankan: npm run test:kalimat */
import assert from "node:assert/strict";
import {
  hargaPerJemput,
  iramaJemput,
  satuanSiklus,
  teksKuitansi,
} from "./kalimat";
import {
  PAKET,
  TAGIHAN,
  WASTE_CATEGORIES,
  cariBenda,
  contohBenda,
} from "./mock";
import type { Invoice, Plan } from "./types";

const paket = (p: Partial<Plan>): Plan => ({
  id: "x",
  name: "X",
  billingCycle: "bulanan",
  pickupQuota: 8,
  price: 45_000,
  isActive: true,
  ...p,
});

/* Paket mingguan menyebut angkanya apa adanya — kuotanya memang per minggu,
   jadi "sekitar" di situ justru menyesatkan. */
assert.equal(
  iramaJemput(paket({ billingCycle: "mingguan", pickupQuota: 2 })),
  "2 jemput · 2× seminggu",
);
assert.equal(
  iramaJemput(paket({ pickupQuota: 8 })),
  "8 jemput · sekitar 2× seminggu",
);
assert.equal(
  iramaJemput(paket({ pickupQuota: 4 })),
  "4 jemput · sekitar 1× seminggu",
);
/* Satu jemput sebulan membulat ke 0× — dan "0× seminggu" berarti truk tidak
   pernah datang, yang bukan isi paketnya. */
assert.equal(
  iramaJemput(paket({ pickupQuota: 1 })),
  "1 jemput · sekitar 1× seminggu",
);
console.log("✓ irama jemput: mingguan persis, bulanan dibulatkan, minimum 1×");

assert.equal(hargaPerJemput(paket({ price: 45_000, pickupQuota: 8 })), 5_625);
assert.equal(hargaPerJemput(paket({ price: 14_000, pickupQuota: 2 })), 7_000);
console.log("✓ harga per jemput");

assert.equal(satuanSiklus("bulanan"), "bulan");
assert.equal(satuanSiklus("mingguan"), "minggu");
console.log("✓ satuan siklus");

/* Tangga harganya harus benar-benar menurun — kalau tidak, kolom
   "Rp x/jemput" di layar justru menyarankan paket yang salah. */
const bulanan = PAKET.filter((p) => p.billingCycle === "bulanan");
for (let i = 1; i < bulanan.length; i++) {
  assert.ok(
    hargaPerJemput(bulanan[i]) < hargaPerJemput(bulanan[i - 1]),
    `${bulanan[i].name} tidak lebih murah per jemput daripada ${bulanan[i - 1].name}`,
  );
}
console.log("✓ paket bulanan: makin besar kuotanya, makin murah per jemput");

const tagihan = (t: Partial<Invoice>): Invoice => ({
  id: "inv-x",
  code: "PY-INV-9001",
  planName: "Bulanan Hemat",
  amount: 25_000,
  method: "GoPay",
  paidAt: "2026-08-13",
  periodStart: "2026-08-13",
  periodEnd: "2026-09-12",
  status: "lunas",
  ...t,
});

/* Kuitansi dibawa warga ke pengurus saat uangnya dipersoalkan, jadi jumlah,
   kode, dan masa langganannya wajib ada apa adanya. */
const lunas = teksKuitansi(tagihan({}));
assert.match(lunas, /PY-INV-9001/);
assert.match(lunas, /Bulanan Hemat/);
assert.match(lunas, /25\.000/);
assert.match(lunas, /13 Agustus 2026 sampai 12 September 2026/);
assert.match(lunas, /Status {4}: Lunas/);
/* Baris sebab hanya milik tagihan gagal — menyisakannya kosong di kuitansi
   lunas membuat warga mengira ada yang tidak beres. */
assert.ok(!lunas.includes("Sebab"));

const gagal = teksKuitansi(
  tagihan({ status: "gagal", failureReason: "Saldo tidak cukup." }),
);
assert.match(gagal, /Status {4}: Gagal/);
assert.match(gagal, /Sebab {5}: Saldo tidak cukup\./);
console.log("✓ kuitansi: kode, jumlah, masa, dan sebab gagal hanya saat gagal");

/* Tiap tagihan tiruan harus bisa dirakit jadi kuitansi — kalau ada kolom yang
   lupa diisi, ketahuan di sini, bukan di tangan warga. */
for (const t of TAGIHAN) {
  assert.match(teksKuitansi(t), new RegExp(t.code));
}
console.log("✓ semua tagihan tiruan punya kuitansi lengkap");

/* Contoh benda hanya berguna kalau menyebut yang TIDAK ada di deskripsi —
   kalau tidak, panduan cuma mengulang dirinya sendiri. */
for (const k of WASTE_CATEGORIES) {
  const contohnya = contohBenda(k.key);
  assert.ok(contohnya.length >= 3, `${k.name} kekurangan contoh benda`);
  const deskripsi = k.description.toLowerCase();
  for (const contoh of contohnya) {
    assert.ok(
      !deskripsi.includes(contoh.toLowerCase()),
      `contoh "${contoh}" sudah disebut di deskripsi ${k.name}`,
    );
  }
}
console.log("✓ panduan: tiap jenis punya contoh benda yang belum disebut");

/* Pencarian adalah satu-satunya jalan warga menemukan jawaban saat berdiri
   di depan tong, jadi yang dicarinya harus ketemu. */
assert.deepEqual(
  cariBenda("telur").map((b) => b.nama),
  ["kulit telur", "kardus telur"],
);
assert.equal(cariBenda("  STYROFOAM ")[0]?.jenis, "campuran");
/* Mengetik nama jenis berarti "apa saja yang masuk sini", bukan mencari
   benda bernama "plastik". */
assert.ok(cariBenda("plastik").length >= 8);
assert.ok(cariBenda("plastik").every((b) => b.jenis === "plastik"));
/* Kueri kosong jangan membanjiri layar dengan seluruh daftar. */
assert.deepEqual(cariBenda("   "), []);
assert.deepEqual(cariBenda("kulkas"), []);
console.log("✓ cari benda: nama, nama jenis, spasi, dan yang tidak ketemu");

console.log("\nSemua pemeriksaan kalimat lulus.");
