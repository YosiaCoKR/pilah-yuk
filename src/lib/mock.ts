import type {
  Invoice,
  Plan,
  WasteCategory,
  WasteItem,
  WasteKey,
} from "./types";

/* Konten tetap (jenis sampah, benda, tips, FAQ) — isinya sama dengan seed
   server. PAKET, TAGIHAN, dan HP_TERDAFTAR tinggal sebagai fixture tes;
   data warga datang dari API (src/lib/data.ts). */

export const WASTE_CATEGORIES: WasteCategory[] = [
  {
    key: "organik",
    name: "Organik",
    description: "Sisa makanan, daun, kulit buah",
    handlingTip: "Tiriskan dulu biar tidak bocor dan bau di perjalanan.",
  },
  {
    key: "plastik",
    name: "Plastik",
    description: "Botol, kemasan, kresek",
    handlingTip: "Bilas sebentar lalu pipihkan supaya tidak makan tempat.",
  },
  {
    key: "kertas",
    name: "Kertas",
    description: "Kardus, koran, buku bekas",
    handlingTip: "Simpan kering — kertas basah tidak bisa didaur ulang.",
  },
  {
    key: "campuran",
    name: "Campuran",
    description: "Belum terpilah",
    handlingTip: "Boleh, tapi petugas butuh waktu lebih lama memilah.",
  },
];

/**
 * Benda sehari-hari yang warga cari. Yang `sorot` naik jadi contoh di kartu
 * jenis, dan sengaja BUKAN pengulangan `description` — deskripsi menyebut
 * yang sudah jelas, contoh menyebut yang membuat orang berhenti di depan
 * tong. `catatan` hanya diisi kalau jawabannya bikin kaget.
 */
export const BENDA: WasteItem[] = [
  { nama: "kulit telur", jenis: "organik", sorot: true },
  { nama: "ampas kopi", jenis: "organik", sorot: true },
  {
    nama: "teh celup",
    jenis: "organik",
    sorot: true,
    catatan: "Kantongnya ikut saja; benangnya dibuang ke campuran.",
  },
  { nama: "tulang ayam", jenis: "organik", sorot: true },
  { nama: "sisa nasi", jenis: "organik" },
  { nama: "kulit buah", jenis: "organik" },
  { nama: "daun kering", jenis: "organik" },
  { nama: "sayur busuk", jenis: "organik" },

  { nama: "tutup galon", jenis: "plastik", sorot: true },
  { nama: "sedotan", jenis: "plastik", sorot: true },
  {
    nama: "bungkus sampo",
    jenis: "plastik",
    sorot: true,
    catatan:
      "Sachet memang sulit didaur ulang, tapi tetap dipisah dari organik.",
  },
  { nama: "gelas plastik", jenis: "plastik", sorot: true },
  { nama: "botol air", jenis: "plastik" },
  { nama: "kresek", jenis: "plastik" },
  { nama: "kemasan mi", jenis: "plastik" },
  { nama: "galon rusak", jenis: "plastik" },

  { nama: "kotak sepatu", jenis: "kertas", sorot: true },
  { nama: "gulungan tisu", jenis: "kertas", sorot: true },
  {
    nama: "amplop",
    jenis: "kertas",
    sorot: true,
    catatan: "Jendela plastiknya disobek dulu kalau ada.",
  },
  { nama: "kardus telur", jenis: "kertas", sorot: true },
  { nama: "kardus", jenis: "kertas" },
  { nama: "koran", jenis: "kertas" },
  { nama: "buku tulis", jenis: "kertas" },
  { nama: "majalah", jenis: "kertas" },

  {
    nama: "popok",
    jenis: "campuran",
    sorot: true,
    catatan: "Bungkus rapat dulu supaya petugas aman memegangnya.",
  },
  {
    nama: "styrofoam",
    jenis: "campuran",
    sorot: true,
    mirip: "plastik",
    catatan:
      "Terlihat seperti plastik, tapi tidak ada yang mendaur ulangnya di sini.",
  },
  {
    nama: "pecahan kaca",
    jenis: "campuran",
    sorot: true,
    catatan:
      "Bungkus koran dan tulisi \u201ckaca\u201d — tangan petugas yang membongkarnya.",
  },
  { nama: "puntung rokok", jenis: "campuran", sorot: true },
  {
    nama: "tisu bekas",
    jenis: "campuran",
    mirip: "kertas",
    catatan: "Sudah kotor dan basah, jadi tidak bisa ikut kertas.",
  },
  { nama: "masker", jenis: "campuran" },
  {
    nama: "sikat gigi",
    jenis: "campuran",
    mirip: "plastik",
    catatan: "Campuran plastik dan nilon yang tidak bisa dipisah lagi.",
  },
  {
    nama: "kemasan minyak",
    jenis: "campuran",
    mirip: "plastik",
    catatan:
      "Berminyak di dalam; kalau sempat dicuci bersih, boleh ikut plastik.",
  },
];

/** Contoh benda untuk kartu jenis — diambil dari daftar yang sama. */
export const contohBenda = (jenis: WasteKey) =>
  BENDA.filter((b) => b.jenis === jenis && b.sorot).map((b) => b.nama);

/** Seluruh benda satu jenis, untuk daftar kategori yang dibuka penuh. */
export const bendaJenis = (jenis: WasteKey) =>
  BENDA.filter((b) => b.jenis === jenis);

/**
 * Benda jenis LAIN yang sering dikira masuk sini.
 *
 * Dibaca dari `mirip`, bukan ditebak dari kata di `catatan`: catatan "jendela
 * plastiknya disobek dulu" menyebut plastik tanpa ada yang pernah mengira
 * amplop itu plastik — dan panduan yang salah menaruh benda di tong yang
 * salah.
 */
export const seringTertukar = (jenis: WasteKey): WasteItem[] =>
  BENDA.filter((b) => b.mirip === jenis);

/**
 * Cari benda menurut namanya, atau menurut nama jenisnya — warga yang
 * mengetik "plastik" sedang bertanya apa saja yang masuk plastik, bukan
 * mencari benda bernama plastik.
 */
export function cariBenda(kata: string): WasteItem[] {
  const q = kata.trim().toLowerCase();
  if (!q) return [];
  return BENDA.filter(
    (b) =>
      b.nama.includes(q) ||
      WASTE_CATEGORIES.find((k) => k.key === b.jenis)!
        .name.toLowerCase()
        .includes(q),
  );
}

/**
 * Tips pilah yang berotasi tiap hari.
 *
 * Dirakit dari dua sumber yang SUDAH ada: cara menangani tiap jenis, dan
 * catatan benda yang jawabannya bikin kaget. Bukan daftar tips terpisah —
 * daftar kedua akan segera bertentangan dengan panduan di halaman jenis, dan
 * warga yang menemukan dua nasihat berbeda akan berhenti mempercayai
 * keduanya.
 */
export type TipPilah = {
  teks: string;
  jenis: WasteKey;
  /** Terisi kalau tipnya berangkat dari satu benda tertentu. */
  benda?: string;
};

export const TIPS_PILAH: TipPilah[] = [
  ...WASTE_CATEGORIES.map((k) => ({ teks: k.handlingTip, jenis: k.key })),
  ...BENDA.filter((b) => b.catatan).map((b) => ({
    teks: b.catatan!,
    jenis: b.jenis,
    benda: b.nama,
  })),
];

/**
 * Tip untuk satu tanggal. Berotasi menurut tanggalnya, bukan diundi: satu
 * tip yang sama untuk semua warga sepanjang hari itu, jadi "tips hari ini"
 * bisa jadi bahan obrolan di grup RT — dan tidak berganti sendiri tiap kali
 * halamannya dibuka ulang.
 */
export function tipHari(iso: string): TipPilah {
  /* Date.parse("yyyy-mm-dd") = tengah malam UTC, jadi pembagiannya jatuh
     persis di batas hari — beda dari parseISO yang waktu lokal dan bisa
     bergeser sehari di zona berpenghematan waktu siang. */
  const hari = Math.floor(Date.parse(iso) / 86_400_000);
  return TIPS_PILAH[
    ((hari % TIPS_PILAH.length) + TIPS_PILAH.length) % TIPS_PILAH.length
  ];
}

/** Bin colour per category. Used anywhere a category needs identifying. */
export const WASTE_COLOR: Record<WasteKey, string> = {
  organik: "var(--color-organik)",
  plastik: "var(--color-plastik)",
  kertas: "var(--color-kertas)",
  campuran: "var(--color-campuran)",
};

export function categoryByKey(key: WasteKey) {
  return WASTE_CATEGORIES.find((c) => c.key === key)!;
}

/**
 * Paket yang ditawarkan, urut dari termurah.
 *
 * Harga per jemput turun seiring kuota naik — itu tangga yang nyata, dan
 * halaman langganan mencetaknya supaya warga bisa membandingkan tanpa
 * berhitung sendiri.
 */
export const PAKET: Plan[] = [
  {
    id: "pl-1",
    name: "Mingguan Coba",
    billingCycle: "mingguan",
    pickupQuota: 2,
    price: 14_000,
    isActive: true,
  },
  {
    id: "pl-2",
    name: "Bulanan Hemat",
    billingCycle: "bulanan",
    pickupQuota: 4,
    price: 25_000,
    isActive: true,
  },
  {
    id: "pl-3",
    name: "Bulanan Rumah Tangga",
    billingCycle: "bulanan",
    pickupQuota: 8,
    price: 45_000,
    isActive: true,
  },
  {
    id: "pl-4",
    name: "Bulanan Rumah Besar",
    billingCycle: "bulanan",
    pickupQuota: 16,
    price: 80_000,
    /* Belum dilayani RW 05 — armadanya belum sanggup. Dibiarkan tampil supaya
       warga tahu paketnya ada, bukan hilang tanpa sebab. */
    isActive: false,
  },
];

/**
 * Riwayat tagihan, terbaru di atas.
 *
 * Satu tagihan gagal ikut disimpan: nomor virtual account memang bisa
 * kedaluwarsa sebelum dibayar, dan warga yang mencari tahu "kenapa jemput saya
 * berhenti bulan itu" butuh melihatnya — bukan menemukan bulan yang kosong.
 */
export const TAGIHAN: Invoice[] = [
  {
    id: "inv-4",
    code: "PY-INV-4712",
    planName: "Bulanan Rumah Tangga",
    amount: 45_000,
    method: "QRIS",
    paidAt: "2026-10-12",
    periodStart: "2026-10-12",
    periodEnd: "2026-11-12",
    status: "lunas",
  },
  {
    id: "inv-3",
    code: "PY-INV-4409",
    planName: "Bulanan Rumah Tangga",
    amount: 45_000,
    method: "Transfer BCA",
    paidAt: "2026-09-12",
    periodStart: "2026-09-12",
    periodEnd: "2026-10-12",
    status: "lunas",
  },
  {
    id: "inv-1",
    code: "PY-INV-4103",
    planName: "Bulanan Hemat",
    amount: 25_000,
    method: "GoPay",
    paidAt: "2026-08-13",
    periodStart: "2026-08-13",
    periodEnd: "2026-09-12",
    status: "lunas",
  },
  {
    id: "inv-2",
    code: "PY-INV-4098",
    planName: "Bulanan Hemat",
    amount: 25_000,
    method: "Transfer BCA",
    paidAt: "2026-08-12",
    periodStart: "2026-08-12",
    periodEnd: "2026-09-12",
    status: "gagal",
    failureReason: "Nomor virtual account kedaluwarsa sebelum dibayar.",
  },
];

/* Nomor yang dianggap sudah punya akun, buat menguji layar pendaftaran. */
export const HP_TERDAFTAR = ["081234567890", "085600112233"];
/* Pertanyaan yang paling sering masuk ke pengurus. Jawabannya sengaja
   menyebut angka & langkah konkret, bukan "silakan hubungi admin". */
export type Faq = { topik: string; tanya: string; jawab: string };

/**
 * Semua kata kunci harus muncul (di topik, pertanyaan, atau jawaban):
 * "bayar qris" menyempit ke jawaban soal QRIS, bukan melebar ke semua yang
 * menyebut "bayar". Kosong = semua FAQ.
 */
export function cariFaq(kata: string, daftar: Faq[] = FAQ): Faq[] {
  const kunci = kata.toLowerCase().split(/\s+/).filter(Boolean);
  return daftar.filter((f) => {
    const teks = `${f.topik} ${f.tanya} ${f.jawab}`.toLowerCase();
    return kunci.every((k) => teks.includes(k));
  });
}
export const FAQ: Faq[] = [
  {
    topik: "Penjemputan",
    tanya: "Jam berapa petugas datang?",
    jawab:
      "Sesuai slot yang kamu pilih saat memesan (mis. 06.00–08.00). Status berubah jadi “Dijemput” begitu petugas berangkat ke alamatmu.",
  },
  {
    topik: "Penjemputan",
    tanya: "Bagaimana kalau saya tidak di rumah?",
    jawab:
      "Taruh sampah di depan pagar dan isi patokan alamat dengan jelas. Petugas tetap menimbang dan memotret bukti pengangkutan.",
  },
  {
    topik: "Penjemputan",
    tanya: "Bisa membatalkan atau menggeser jemput?",
    jawab:
      "Bisa, selama statusnya masih “Menunggu”. Untuk jadwal rutin, pakai Jeda jadwal saat keluar kota — kuota tidak terpakai.",
  },
  {
    topik: "Langganan & pembayaran",
    tanya: "Pembayaran apa saja yang diterima?",
    jawab:
      "QRIS, e-wallet (GoPay, OVO, DANA, ShopeePay), dan transfer virtual account bank. Langganan aktif otomatis begitu pembayaran terkonfirmasi.",
  },
  {
    topik: "Langganan & pembayaran",
    tanya: "Sudah bayar tapi langganan belum aktif?",
    jawab:
      "Biasanya terkonfirmasi dalam 1–5 menit. Kalau lebih dari 30 menit, buka Tagihan lalu kirim bukti bayarnya ke pengurus channel.",
  },
  {
    topik: "Langganan & pembayaran",
    tanya: "Kuota jemput habis sebelum akhir bulan?",
    jawab:
      "Kamu tetap bisa memesan jemput tambahan, atau naik ke paket dengan kuota lebih besar mulai periode berikutnya.",
  },
  {
    topik: "Akun & channel",
    tanya: "Kenapa harus gabung channel RT/RW?",
    jawab:
      "Petugas dibagi per wilayah. Tanpa channel, pesananmu belum bisa diteruskan ke petugas yang melayani rumahmu.",
  },
  {
    topik: "Akun & channel",
    tanya: "Lupa kata sandi?",
    jawab:
      "Di layar Masuk, pilih “Lupa kata sandi”, masukkan nomor HP, lalu ketik kode yang dikirim lewat SMS.",
  },
];
