/**
 * Riwayat contoh untuk satu warga demo.
 *
 * Terpisah dari `seed.ts`: itu data acuan yang memang harus ada di produksi
 * (kategori, slot jam, paket), sedangkan ini warga palsu — kalau keduanya satu
 * berkas, sekali salah ketik `npm run db:seed` di produksi akan menanam Bu Rina
 * di tengah warga sungguhan.
 *
 * Tanggalnya relatif terhadap hari dijalankan, bukan tanggal mati. Layar
 * riwayat mengelompokkan per bulan dan menjumlahkan berat per bulan; dengan
 * tanggal mati seluruh contoh akan pelan-pelan menumpuk di satu bulan jauh di
 * belakang dan pengelompokan itu tidak terlihat lagi.
 *
 * Jalankan: DATABASE_URL=... npm run db:contoh   (setelah npm run db:seed)
 */
import { eq, inArray, ne } from "drizzle-orm";
import type { Db } from ".";
import {
  addresses,
  pickupItems,
  pickups,
  rwChannels,
  subscriptionPlans,
  subscriptions,
  timeSlots,
  users,
  wasteCategories,
} from "./schema";

/* UUID tetap: menjalankan ulang tidak menumpuk warga demo kedua, dan id-nya
   bisa disebut langsung saat menguji layar. */
export const WARGA_CONTOH = "11111111-1111-1111-1111-111111111111";
const RUMAH = "aaaaaaaa-0000-4000-8000-000000000001";
const RUMAH_IBU = "aaaaaaaa-0000-4000-8000-000000000002";
const WARUNG = "aaaaaaaa-0000-4000-8000-000000000003";

const PAGI = "06.00–08.00";
const SIANG = "09.00–11.00";

/** ISO yyyy-mm-dd, `geser` hari dari hari ini. */
function hari(geser: number) {
  const d = new Date();
  d.setDate(d.getDate() + geser);
  return d.toISOString().slice(0, 10);
}

/**
 * Riwayat lintas tiga bulan.
 *
 * Isinya dipilih supaya tiap keadaan layar punya satu contoh: alamat berbeda,
 * petugas berbeda (kartu "Diangkut oleh" menghitung per petugas per alamat),
 * ada yang pakai catatan dan ada yang tidak, serta satu yang batal — yang
 * batal tidak punya berat maupun petugas, dan di situlah tampilan paling
 * sering salah.
 */
/** Satu baris riwayat contoh. `batal` menggantikan berat & petugas. */
type BarisContoh = {
  kode: string;
  geser: number;
  slot: string;
  alamat: string;
  jenis: string[];
  berat?: string;
  petugas?: string;
  catatan?: string;
  batal?: true;
};

const RIWAYAT: BarisContoh[] = [
  { kode: "PY-4790", geser: -3, slot: PAGI, alamat: RUMAH, jenis: ["organik", "kertas"], berat: "6.40", petugas: "Pak Dedi" },
  { kode: "PY-4755", geser: -6, slot: SIANG, alamat: WARUNG, jenis: ["campuran"], berat: "11.20", petugas: "Pak Dedi", catatan: "Dua karung dari kios" },
  { kode: "PY-4712", geser: -10, slot: PAGI, alamat: RUMAH, jenis: ["organik", "plastik", "kertas"], berat: "8.10", petugas: "Bu Sri" },
  { kode: "PY-4701", geser: -13, slot: PAGI, alamat: RUMAH, jenis: ["organik", "plastik"], berat: "7.20", petugas: "Pak Dedi" },
  { kode: "PY-4688", geser: -17, slot: PAGI, alamat: RUMAH_IBU, jenis: ["organik"], berat: "4.80", petugas: "Bu Sri" },
  { kode: "PY-4650", geser: -38, slot: SIANG, alamat: WARUNG, jenis: ["campuran"], berat: "13.50", petugas: "Pak Dedi" },
  { kode: "PY-4631", geser: -45, slot: PAGI, alamat: RUMAH, jenis: ["kertas"], catatan: "Keluar kota mendadak", batal: true },
  { kode: "PY-4602", geser: -66, slot: PAGI, alamat: RUMAH, jenis: ["organik", "plastik"], berat: "5.90", petugas: "Pak Dedi" },
];

type Hasil =
  | { ditanam: number }
  | { lewat: "sudah-ada" }
  | { gagal: string };

/**
 * Tanam riwayat contoh. Aman dijalankan berulang, dan menolak diri sendiri
 * kalau basis datanya ternyata bukan basis data contoh.
 */
export async function tanamContoh(db: Db): Promise<Hasil> {
  /* Pagar produksi. Bukan env flag — yang betul-betul ingin dicegah adalah
     DATABASE_URL produksi yang tertempel tanpa sengaja, dan basis data itu
     mengenali dirinya sendiri: ia sudah berisi penjemputan warga lain. */
  const [milikOrangLain] = await db
    .select({ id: pickups.id })
    .from(pickups)
    .where(ne(pickups.userId, WARGA_CONTOH))
    .limit(1);
  if (milikOrangLain) {
    return {
      gagal:
        "Basis data ini sudah berisi penjemputan warga lain, jadi sepertinya " +
        "bukan basis data contoh. Riwayat contoh tidak ditanam.",
    };
  }

  const [sudahAda] = await db
    .select({ id: pickups.id })
    .from(pickups)
    .where(eq(pickups.userId, WARGA_CONTOH))
    .limit(1);
  if (sudahAda) return { lewat: "sudah-ada" };

  /* Data acuan harus lebih dulu ada — contoh ini menumpang di atasnya, tidak
     membuat versi sendiri yang bisa berbeda isinya. */
  const slot = new Map(
    (
      await db
        .select({ id: timeSlots.id, label: timeSlots.label })
        .from(timeSlots)
    ).map((s) => [s.label, s.id]),
  );
  const kategori = new Map(
    (
      await db
        .select({ id: wasteCategories.id, slug: wasteCategories.slug })
        .from(wasteCategories)
    ).map((k) => [k.slug, k.id]),
  );

  const kurang = [
    ...new Set(RIWAYAT.flatMap((r) => r.jenis)),
  ].filter((slug) => !kategori.has(slug));
  if (!slot.has(PAGI) || !slot.has(SIANG) || kurang.length > 0) {
    return {
      gagal: "Jalankan `npm run db:seed` dulu: slot jam & kategori belum ada.",
    };
  }

  /* Kode contoh tidak boleh menabrak kode yang sudah terpakai — kode itulah
     yang dipakai warga dan petugas untuk saling menyebut satu penjemputan. */
  const bentrok = await db
    .select({ code: pickups.code })
    .from(pickups)
    .where(
      inArray(
        pickups.code,
        RIWAYAT.map((r) => r.kode),
      ),
    );
  if (bentrok.length > 0) {
    return {
      gagal: `Kode ${bentrok.map((b) => b.code).join(", ")} sudah terpakai.`,
    };
  }

  const [channelAda] = await db
    .select({ id: rwChannels.id })
    .from(rwChannels)
    .where(eq(rwChannels.name, "RW 05 Sukamaju"))
    .limit(1);
  const channelId =
    channelAda?.id ??
    (
      await db
        .insert(rwChannels)
        .values({ name: "RW 05 Sukamaju", areaCode: "3573" })
        .returning({ id: rwChannels.id })
    )[0].id;

  await db
    .insert(users)
    .values({
      id: WARGA_CONTOH,
      fullName: "Bu Rina (contoh)",
      phone: "081100000001",
    })
    .onConflictDoNothing({ target: users.id });

  await db
    .insert(addresses)
    .values([
      {
        id: RUMAH,
        userId: WARGA_CONTOH,
        label: "Rumah",
        fullAddress: "Jl. Kenanga No. 12, RT 03 / RW 05, Kel. Sukamaju",
        landmark: "Sebelah warung Bu Tini, pagar hijau",
        rwChannelId: channelId,
        isDefault: true,
      },
      {
        id: RUMAH_IBU,
        userId: WARGA_CONTOH,
        label: "Rumah Ibu",
        fullAddress: "Jl. Melati Dalam No. 4, RT 01 / RW 05, Kel. Sukamaju",
        landmark: "Depan musala Al-Ikhlas",
        rwChannelId: channelId,
      },
      {
        id: WARUNG,
        userId: WARGA_CONTOH,
        label: "Warung",
        fullAddress: "Kios 7 Pasar Sukamaju, RT 06 / RW 05",
        landmark: "Blok daging, pintu timur",
        rwChannelId: channelId,
      },
    ])
    .onConflictDoNothing({ target: addresses.id });

  /* Langganan aktif: tanpa ini riwayatnya memang terisi, tapi tombol "Pesan
     jemput" tertutup gerbang langganan dan demo berhenti di situ. */
  const [paket] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, "Bulanan Rumah Tangga"))
    .limit(1);
  const [adaLangganan] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, WARGA_CONTOH))
    .limit(1);
  if (paket && !adaLangganan) {
    await db.insert(subscriptions).values({
      userId: WARGA_CONTOH,
      planId: paket.id,
      status: "aktif",
      startDate: hari(-18),
      endDate: hari(12),
    });
  }

  for (const r of RIWAYAT) {
    const [p] = await db
      .insert(pickups)
      .values({
        code: r.kode,
        userId: WARGA_CONTOH,
        addressId: r.alamat,
        channelId,
        pickupDate: hari(r.geser),
        timeSlotId: slot.get(r.slot)!,
        status: r.batal ? "batal" : "selesai",
        totalWeightKg: r.berat ?? null,
        officerName: r.petugas ?? null,
        notes: r.catatan ?? null,
      })
      .returning({ id: pickups.id });

    await db.insert(pickupItems).values(
      r.jenis.map((slug) => ({
        pickupId: p.id,
        categoryId: kategori.get(slug)!,
      })),
    );
  }

  return { ditanam: RIWAYAT.length };
}

/* Dijalankan sebagai skrip (bukan di-import pemeriksaan). */
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { buatDb } = await import(".");
  const { env } = await import("../env");
  const hasil = await tanamContoh(buatDb(env.databaseUrl));

  if ("gagal" in hasil) {
    console.error(`Dibatalkan: ${hasil.gagal}`);
    process.exit(1);
  }
  console.log(
    "lewat" in hasil
      ? "Riwayat contoh sudah ada. Tidak ada yang ditanam."
      : `Riwayat contoh selesai: ${hasil.ditanam} penjemputan untuk warga ${WARGA_CONTOH}.`,
  );
  process.exit(0);
}
