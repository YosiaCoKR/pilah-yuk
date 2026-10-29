/**
 * Data acuan yang harus ada sebelum aplikasi bisa dipakai: kategori sampah,
 * slot jam, dan paket langganan. Aman dijalankan berulang.
 *
 * Jalankan: DATABASE_URL=... npm run db:seed
 */
import { buatDb } from ".";
import { env } from "../env";
import { subscriptionPlans, timeSlots, wasteCategories } from "./schema";

const db = buatDb(env.databaseUrl);

await db
  .insert(wasteCategories)
  .values([
    {
      slug: "organik",
      name: "Organik",
      description: "Sisa makanan, daun, kulit buah",
      handlingTip: "Tiriskan dulu biar tidak bocor dan bau di perjalanan.",
    },
    {
      slug: "plastik",
      name: "Plastik",
      description: "Botol, kemasan, kresek",
      handlingTip: "Bilas sebentar lalu pipihkan supaya tidak makan tempat.",
    },
    {
      slug: "kertas",
      name: "Kertas",
      description: "Kardus, koran, buku bekas",
      handlingTip: "Simpan kering — kertas basah tidak bisa didaur ulang.",
    },
    {
      slug: "campuran",
      name: "Campuran",
      description: "Belum terpilah",
      handlingTip: "Boleh, tapi petugas butuh waktu lebih lama memilah.",
    },
  ])
  .onConflictDoNothing({ target: wasteCategories.slug });

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

console.log("Seed selesai: kategori sampah, slot jam, dan paket langganan.");
process.exit(0);
