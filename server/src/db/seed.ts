/**
 * Data acuan yang harus ada sebelum aplikasi bisa dipakai: kategori sampah,
 * benda panduan pilah, slot jam, dan paket langganan. Aman dijalankan
 * berulang.
 *
 * Jalankan: DATABASE_URL=... npm run db:seed
 */
import { sql } from "drizzle-orm";
import { buatDb } from ".";
import { env } from "../env";
import {
  subscriptionPlans,
  timeSlots,
  wasteCategories,
  wasteGuideItems,
} from "./schema";

const db = buatDb(env.databaseUrl);

await db
  .insert(wasteCategories)
  .values([
    {
      slug: "organik",
      sortOrder: 1,
      name: "Organik",
      description: "Sisa makanan, daun, kulit buah",
      handlingTip: "Tiriskan dulu biar tidak bocor dan bau di perjalanan.",
    },
    {
      slug: "plastik",
      sortOrder: 2,
      name: "Plastik",
      description: "Botol, kemasan, kresek",
      handlingTip: "Bilas sebentar lalu pipihkan supaya tidak makan tempat.",
    },
    {
      slug: "kertas",
      sortOrder: 3,
      name: "Kertas",
      description: "Kardus, koran, buku bekas",
      handlingTip: "Simpan kering — kertas basah tidak bisa didaur ulang.",
    },
    {
      slug: "campuran",
      sortOrder: 4,
      name: "Campuran",
      description: "Belum terpilah",
      handlingTip: "Boleh, tapi petugas butuh waktu lebih lama memilah.",
    },
  ])
  /* Urutan panduan ikut diperbarui pada basis data yang sudah jalan — dengan
     doNothing, semua kategori lama tetap `sort_order` 0 dan urutan panduan
     kembali acak. Nama & penjelasannya ikut: kalimat yang diperbaiki di sini
     harus benar-benar sampai ke warga. */
  .onConflictDoUpdate({
    target: wasteCategories.slug,
    set: {
      name: sql`excluded.name`,
      description: sql`excluded.description`,
      handlingTip: sql`excluded.handling_tip`,
      sortOrder: sql`excluded.sort_order`,
    },
  });

/*
  Benda panduan pilah.

  `nama` huruf kecil, seperti warga mengetiknya di kotak cari. `catatan`
  hanya untuk yang jawabannya bikin kaget — catatan di setiap benda membuat
  yang penting tenggelam. `mirip` diisi hanya kalau salah kiranya memang
  umum.
*/
const kunci = await db
  .select({ id: wasteCategories.id, slug: wasteCategories.slug })
  .from(wasteCategories);
const idJenis = new Map(kunci.map((k) => [k.slug, k.id]));

type Benda = {
  nama: string;
  jenis: string;
  catatan?: string;
  sorot?: boolean;
  mirip?: string;
};

const BENDA: Benda[] = [
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

await db
  .insert(wasteGuideItems)
  .values(
    BENDA.map((b) => ({
      categoryId: idJenis.get(b.jenis)!,
      name: b.nama,
      note: b.catatan ?? null,
      isHighlighted: b.sorot ?? false,
      mistakenForId: b.mirip ? (idJenis.get(b.mirip) ?? null) : null,
    })),
  )
  /* Jawaban yang diperbaiki harus benar-benar sampai ke warga: baris lama
     DIPERBARUI, bukan dilewati. Benda yang dihapus dari daftar ini tetap
     tertinggal di basis data — menghapusnya butuh keputusan sendiri, bukan
     efek samping seed. */
  .onConflictDoUpdate({
    target: wasteGuideItems.name,
    set: {
      categoryId: sql`excluded.category_id`,
      note: sql`excluded.note`,
      isHighlighted: sql`excluded.is_highlighted`,
      mistakenForId: sql`excluded.mistaken_for_id`,
    },
  });

const adaSlot = await db.select({ id: timeSlots.id }).from(timeSlots).limit(1);
if (adaSlot.length === 0) {
  await db.insert(timeSlots).values([
    {
      label: "06.00–08.00",
      startTime: "06:00:00",
      endTime: "08:00:00",
      note: "Paling sering dipilih",
      capacity: 20,
      sortOrder: 1,
    },
    {
      label: "09.00–11.00",
      startTime: "09:00:00",
      endTime: "11:00:00",
      note: "Petugas lewat setelah pasar",
      capacity: 15,
      sortOrder: 2,
    },
    {
      label: "15.00–17.00",
      startTime: "15:00:00",
      endTime: "17:00:00",
      note: "Sore",
      capacity: 10,
      sortOrder: 3,
    },
    {
      label: "17.00–19.00",
      startTime: "17:00:00",
      endTime: "19:00:00",
      note: "Sebelum magrib",
      capacity: 10,
      sortOrder: 4,
    },
  ]);
}

const adaPaket = await db
  .select({ id: subscriptionPlans.id })
  .from(subscriptionPlans)
  .limit(1);
if (adaPaket.length === 0) {
  await db.insert(subscriptionPlans).values([
    {
      name: "Mingguan Hemat",
      billingCycle: "mingguan",
      price: 15_000,
      pickupQuota: 2,
    },
    {
      name: "Bulanan Rumah Tangga",
      billingCycle: "bulanan",
      price: 45_000,
      pickupQuota: 8,
    },
    {
      name: "Bulanan Warung",
      billingCycle: "bulanan",
      price: 90_000,
      pickupQuota: 20,
    },
  ]);
}

console.log(
  `Seed selesai: kategori sampah (${kunci.length}), benda panduan (${BENDA.length}), slot jam, dan paket langganan.`,
);
process.exit(0);
