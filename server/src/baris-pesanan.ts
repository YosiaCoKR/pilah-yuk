import { eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  addresses,
  pickupItems,
  pickups,
  rwChannels,
  timeSlots,
  wasteCategories,
} from "./db/schema";

/**
 * Satu baris pesanan seperti yang dibaca daftar — riwayat maupun pesanan.
 *
 * Bentuknya dibagi, bukan ditulis ulang per route: dua daftar yang menampilkan
 * hal yang sama tidak boleh pelan-pelan jadi berbeda isinya.
 */
export const kolomBaris = {
  id: pickups.id,
  code: pickups.code,
  status: pickups.status,
  tanggal: pickups.pickupDate,
  jam: timeSlots.label,
  totalWeightKg: pickups.totalWeightKg,
  officerName: pickups.officerName,
  notes: pickups.notes,
  alamatLabel: addresses.label,
  alamatLengkap: addresses.fullAddress,
  channelName: rwChannels.name,
  /* Kategori digabung di SQL — menghindari satu query per pesanan. */
  jenis: sql<string[]>`coalesce(
    array_agg(${wasteCategories.slug}) filter (
      where ${wasteCategories.slug} is not null
    ), '{}'
  )`,
};

/** Kolom pengelompokan yang dituntut agregasi `jenis` di atas. */
export const grupBaris = [
  pickups.id,
  addresses.id,
  timeSlots.id,
  rwChannels.id,
] as const;

/**
 * Query dasar: kolom baris + seluruh join-nya. Pemanggil menambahkan
 * `.where()`, `.groupBy(...grupBaris)`, dan urutannya sendiri.
 */
export const pilihBaris = (db: Db) =>
  db
    .select(kolomBaris)
    .from(pickups)
    .innerJoin(addresses, eq(pickups.addressId, addresses.id))
    .leftJoin(timeSlots, eq(pickups.timeSlotId, timeSlots.id))
    .leftJoin(rwChannels, eq(pickups.channelId, rwChannels.id))
    .leftJoin(pickupItems, eq(pickupItems.pickupId, pickups.id))
    .leftJoin(wasteCategories, eq(pickupItems.categoryId, wasteCategories.id));
