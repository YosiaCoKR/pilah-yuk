/**
 * Pencarian panduan pilah, di atas seed yang sungguhan — bukan data karangan
 * pemeriksaan: aturan "nama benda ATAU nama kategori" baru terbukti kalau
 * dijalankan pada daftar yang benar-benar dikirim ke warga.
 *
 * Jalankan: npm run test:panduan
 */
import assert from "node:assert/strict";
import { isiData } from "../db/seed";
import { lulus, siapkan } from "../test/bantu";

const WARGA = "11111111-1111-1111-1111-111111111111";
const LAIN_TIPS = "55555555-5555-5555-5555-555555555555";
const { db, panggil, klien, schema } = await siapkan();
await db
  .insert(schema.users)
  .values([
    { id: WARGA, fullName: "Bu Rina", phone: "0811" },
    { id: LAIN_TIPS, fullName: "Pak Joko", phone: "0815" },
  ]);
await isiData(db);

const cari = async (kata?: string, sebagai = WARGA) =>
  panggil(
    "GET",
    `/api/panduan/cari${kata === undefined ? "" : `?kata=${encodeURIComponent(kata)}`}`,
    sebagai ? { sebagai } : {},
  );

/* Benda di tangan: yang dicari nama bendanya. */
let r = await cari("styrofoam");
assert.equal(r.status, 200);
assert.equal(r.body.data.length, 1);
assert.deepEqual(r.body.data[0], {
  nama: "styrofoam",
  jenis: "campuran",
  catatan:
    "Terlihat seperti plastik, tapi tidak ada yang mendaur ulangnya di sini.",
  sorot: true,
  /* Inilah yang membuat panduan ini berguna: styrofoam SERING DIKIRA
     plastik, dan itu kolom sendiri — bukan ditebak dari kata di catatan. */
  mirip: "plastik",
});
lulus("cari nama benda → jawaban utuh, termasuk tong yang sering dikira");

/* Potongan kata tetap ketemu: warga mengetik sambil berdiri. */
r = await cari("tELU");
assert.deepEqual(
  r.body.data.map((b: { nama: string }) => b.nama).sort(),
  ["kardus telur", "kulit telur"],
);
lulus("cocok sebagian & tidak peduli huruf besar-kecil");

/* "plastik" = pertanyaan "apa saja yang masuk plastik", bukan benda bernama
   plastik. Nama kategori ikut dicocokkan. */
r = await cari("plastik");
const jenisnya = new Set(r.body.data.map((b: { jenis: string }) => b.jenis));
assert.ok(r.body.data.length >= 8, `cuma ${r.body.data.length} hasil`);
assert.ok(jenisnya.has("plastik"), "isi tong plastik tidak ikut");
/* "gelas plastik" namanya memuat kata itu → naik ke atas. */
assert.equal(r.body.data[0].jenis, "plastik");
assert.ok(
  r.body.data[0].nama.includes("plastik"),
  `urutan salah: ${r.body.data[0].nama} di atas`,
);
lulus("cari nama kategori → seisi tongnya; yang namanya cocok di atas");

/* Benda tanpa catatan: field-nya HILANG, bukan null — layar mencetak baris
   penjelasan kosong kalau null lolos. */
r = await cari("koran");
assert.equal(r.body.data.length, 1);
assert.ok(!("catatan" in r.body.data[0]) || r.body.data[0].catatan === undefined);
assert.ok(!("mirip" in r.body.data[0]) || r.body.data[0].mirip === undefined);
lulus("benda tanpa catatan/salah-kira: field-nya tidak terkirim sebagai null");

/* Kotak cari baru dikosongkan → daftar kosong, bukan galat. */
for (const kata of ["", "   ", undefined]) {
  r = await cari(kata);
  assert.equal(r.status, 200, `kata ${JSON.stringify(kata)} → ${r.status}`);
  assert.deepEqual(r.body.data, []);
}
lulus("kata kosong/spasi/tanpa parameter → daftar kosong, bukan 422");

/* Belum ada di daftar → kosong. Layar yang menjelaskan apa yang harus
   dilakukan warga, bukan server. */
r = await cari("dinamo bekas");
assert.deepEqual(r.body.data, []);
lulus("benda tak dikenal → daftar kosong");

/*
  Wildcard LIKE dikawal.

  Tanpa itu "%" mengembalikan SELURUH panduan dan "_" mencocokkan huruf apa
  pun — warga yang mengetik "100%" akan dapat 32 jawaban yang tidak satu pun
  dia cari, dan pencarian berhenti bisa dipercaya.
*/
for (const nakal of ["%", "_", "100%", "%telur%"]) {
  r = await cari(nakal);
  assert.deepEqual(r.body.data, [], `"${nakal}" menembus kawalan pola`);
}
lulus("%, _, dan '100%' dikawal — bukan mengembalikan seluruh daftar");

/* Batas panjang di gerbang. */
r = await cari("x".repeat(61));
assert.equal(r.status, 422);
lulus("kata > 60 huruf → 422");

r = await cari("styrofoam", "");
assert.equal(r.status, 401);
lulus("tanpa identitas → 401");

/* --- daftar jenis --- */
r = await panggil("GET", "/api/panduan", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.deepEqual(
  r.body.data.map((k: { jenis: string }) => k.jenis),
  ["organik", "plastik", "kertas", "campuran"],
  "urutan panduan disengaja: campuran = belum terpilah, tidak boleh memimpin",
);
const semua = r.body.data.flatMap((k: { benda: unknown[] }) => k.benda);
assert.equal(semua.length, 32, "seluruh benda harus ikut, tanpa dipotong");
lulus("GET /panduan: 4 jenis urut, 32 benda utuh");

/* Kartu jenis mencetak contoh dari yang disorot, lalu "n lainnya" — jadi
   keduanya harus ada dan yang disorot di urutan depan. */
for (const k of r.body.data) {
  assert.ok(k.name && k.description && k.handlingTip, `${k.jenis}: teks kosong`);
  const sorot = k.benda.filter((b: { sorot: boolean }) => b.sorot);
  assert.ok(sorot.length > 0, `${k.jenis}: tidak ada contoh`);
  assert.equal(
    k.benda[0].sorot,
    true,
    `${k.jenis}: benda tersorot tidak di urutan depan`,
  );
  /* Respons ringan: kartu jenis hanya mencetak nama + pemisah contoh, jadi
     yang lain tidak boleh ikut terkirim. `jenis` pun jelas dari kelompok yang
     menampungnya. */
  for (const b of k.benda) {
    assert.deepEqual(Object.keys(b).sort(), ["nama", "sorot"], `${b.nama} membawa field berlebih`);
  }
}
lulus("tiap jenis: teks lengkap, contoh tersorot di depan, benda ringkas");

/* Ukuran dipaku: halaman ini dibuka sambil berdiri di depan tong, kadang di
   sinyal satu bar. Sebelum dipangkas 3053 B; batas di bawah memberi ruang
   tumbuh tanpa membiarkan field yang tak terbaca kembali menyelip. */
const berat = JSON.stringify(r.body).length;
assert.ok(berat < 2000, `GET /panduan ${berat} B — ada field yang tidak dicetak ikut terkirim`);
lulus(`GET /panduan ${berat} B (dari 3053 B sebelum dipangkas)`);

/* --- detail satu jenis --- */
r = await panggil("GET", "/api/panduan/plastik", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.jenis, "plastik");
assert.equal(r.body.data.handlingTip, "Bilas sebentar lalu pipihkan supaya tidak makan tempat.");
assert.equal(r.body.data.benda.length, 8);
/* Detail TETAP lengkap: halaman jenis memisahkan "tinggal masukkan" dari
   "ada syaratnya" lewat catatan, jadi di sini catatan wajib ikut. */
assert.ok(
  r.body.data.benda.some((b: { catatan?: string }) => b.catatan),
  "detail jenis kehilangan catatan — pemisah 'ada syaratnya' ikut hilang",
);
assert.ok(
  r.body.data.benda.every((b: { jenis: string }) => b.jenis === "plastik"),
);
lulus("GET /panduan/plastik: isi tongnya saja");

/*
  "Sering dikira plastik" datang dari jenis LAIN.

  Layar tidak bisa merakitnya dari daftar plastik — styrofoam itu milik
  campuran — jadi kalau endpoint ini tidak mengirimnya, bagian yang paling
  berguna di halaman jenis hilang diam-diam.
*/
const tertukar = r.body.data.tertukar;
assert.deepEqual(
  tertukar.map((b: { nama: string }) => b.nama).sort(),
  ["kemasan minyak", "sikat gigi", "styrofoam"],
);
assert.ok(
  tertukar.every((b: { jenis: string }) => b.jenis === "campuran"),
  "benda tertukar harus membawa tong yang BENAR, bukan tong yang dikira",
);
lulus("tertukar: benda jenis lain yang sering dikira plastik, bawa tong benarnya");

/* Jenis yang tidak punya benda tertukar tetap dijawab, dengan daftar kosong. */
r = await panggil("GET", "/api/panduan/campuran", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.deepEqual(r.body.data.tertukar, []);
lulus("jenis tanpa benda tertukar → daftar kosong, bukan 404");

/* Salah ketik di URL harus berakhir di halaman tidak-ditemukan, bukan kartu
   kosong yang terlihat seperti panduan yang belum diisi. */
r = await panggil("GET", "/api/panduan/plastk", { sebagai: WARGA });
assert.equal(r.status, 404);
lulus("slug tak dikenal → 404");

/* Jebakan rute: /cari tidak boleh ditelan /:jenis. Kalau tertelan, kotak
   carinya menjawab 404 untuk setiap kata. */
r = await panggil("GET", "/api/panduan/cari?kata=koran", { sebagai: WARGA });
assert.equal(r.status, 200);
assert.equal(r.body.data.length, 1);
lulus("/panduan/cari tidak tertelan /panduan/:jenis");

/* --- tips harian berotasi ---
   Dijalankan SEBELUM jenis tambahan di bawah: jumlah tip = jumlah jenis +
   jumlah catatan benda, jadi menambah satu jenis menggeser panjang
   putarannya. Di sini yang diperiksa justru panjang putaran seed asli. */
const tip = async (tanggal?: string, sebagai = WARGA) =>
  panggil(
    "GET",
    `/api/panduan/tips${tanggal ? `?tanggal=${tanggal}` : ""}`,
    sebagai ? { sebagai } : {},
  );

r = await tip("2026-11-09");
assert.equal(r.status, 200);
assert.ok(r.body.data.teks, "tip tanpa kalimat");
assert.ok(r.body.data.jenis, "tip tanpa tong tujuan");
lulus("GET /panduan/tips: satu tip dengan kalimat & tongnya");

/* Satu tip yang SAMA untuk semua warga sepanjang hari itu — itu yang membuat
   "tips hari ini" bisa jadi bahan obrolan di grup RT. */
const lagi = await tip("2026-11-09");
assert.deepEqual(lagi.body.data, r.body.data);
const wargaLain = await tip("2026-11-09", LAIN_TIPS);
assert.deepEqual(wargaLain.body.data, r.body.data);
lulus("tip sama untuk pemanggil & warga mana pun di tanggal yang sama");

/* Berotasi: hari berikutnya tip lain. */
const besok = await tip("2026-11-10");
assert.notDeepEqual(besok.body.data, r.body.data);
lulus("hari berikutnya → tip lain");

/* 13 tip (4 cara menangani + 9 catatan), jadi 13 hari berputar sekali penuh
   dan hari ke-14 kembali ke tip yang sama. */
const putaran: string[] = [];
for (let i = 0; i < 13; i++) {
  const d = new Date(Date.UTC(2026, 10, 9) + i * 86_400_000)
    .toISOString()
    .slice(0, 10);
  putaran.push((await tip(d)).body.data.teks);
}
assert.equal(new Set(putaran).size, 13, "ada tip yang terlewat dalam satu putaran");
const genap = await tip("2026-11-22");
assert.equal(genap.body.data.teks, putaran[0], "putaran ke-14 tidak kembali");
lulus("13 hari = satu putaran penuh tanpa tip terlewat, lalu berulang");

/* Tip yang berangkat dari satu benda menyebut bendanya; yang berangkat dari
   cara menangani tidak punya subjek benda. */
const dariBenda = putaran.filter((_, i) => i >= 4).length;
assert.ok(dariBenda > 0);
const semuaTip = await Promise.all(
  putaran.map((_, i) =>
    tip(
      new Date(Date.UTC(2026, 10, 9) + i * 86_400_000).toISOString().slice(0, 10),
    ),
  ),
);
const berbenda = semuaTip.filter((x) => x.body.data.benda);
assert.equal(berbenda.length, 9, "9 catatan benda harus jadi 9 tip berbenda");
assert.equal(
  semuaTip.filter((x) => !x.body.data.benda).length,
  4,
  "4 cara menangani harus jadi 4 tip tanpa benda",
);
lulus("9 tip dari catatan benda (bawa nama benda) + 4 dari cara menangani");

/* Tanpa tanggal → hari ini, tetap satu tip utuh. */
r = await tip();
assert.equal(r.status, 200);
assert.ok(r.body.data.teks);
lulus("tanpa parameter tanggal → tip hari ini");

/*
  Tanggal rancu ditolak.

  "09-11-2026" LOLOS `format: "date"` bawaan (yang hanya memeriksa "bisa
  di-parse jadi Date"), dan di endpoint ini tidak ada perbandingan tanggal
  yang kebetulan menolaknya — warga akan dapat tip hari lain tanpa diberi
  tahu. "2026-13-45" lolos polanya tapi bukan tanggal: tanpa penjaga, Date.parse
  jadi NaN dan jawabannya `undefined`, bukan galat.
*/
for (const buruk of ["09-11-2026", "9 Nov 2026", "2026-11", "bukan-tanggal", "2026-13-45"]) {
  r = await tip(buruk);
  assert.equal(r.status, 422, `"${buruk}" lolos sebagai tanggal`);
}
lulus("tanggal rancu/bukan tanggal → 422, bukan tip hari lain");

r = await tip("2026-11-09", "");
assert.equal(r.status, 401);
lulus("tips tanpa identitas → 401");

/* Jenis baru yang bendanya belum diisi tetap tampil: kartunya masih menjawab
   "ini apa" dan "diapakan". */
await db.insert(schema.wasteCategories).values({
  slug: "elektronik",
  name: "Elektronik",
  description: "Baterai, kabel, lampu",
  handlingTip: "Kumpulkan dulu, jangan dicampur — dibawa ke bank sampah RW.",
  sortOrder: 5,
});
r = await panggil("GET", "/api/panduan", { sebagai: WARGA });
const baru = r.body.data.at(-1);
assert.equal(baru.jenis, "elektronik");
assert.deepEqual(baru.benda, []);
lulus("jenis tanpa benda tetap ikut di daftar");

r = await panggil("GET", "/api/panduan");
assert.equal(r.status, 401);
r = await panggil("GET", "/api/panduan/plastik");
assert.equal(r.status, 401);
lulus("daftar & detail tanpa identitas → 401");

await klien.close();
console.log("\nSemua pemeriksaan panduan pilah lulus.");
