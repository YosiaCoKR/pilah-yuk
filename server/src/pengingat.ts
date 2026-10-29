import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  addresses,
  pickups,
  recurringScheduleItems,
  recurringSchedules,
  timeSlots,
  users,
  wasteCategories,
} from "./db/schema";

export type Pengingat = {
  pickupId: string;
  code: string;
  penggunaId: string;
  nama: string;
  /** Salah satunya pasti ada — skema menjamin minimal satu kontak. */
  nomor: string | null;
  email: string | null;
  tanggal: string;
  jam: string;
  alamatLabel: string;
  alamatLengkap: string;
  jenis: string[];
};

/** Besok, dalam ISO yyyy-mm-dd. Pengingat bawaan dikirim sehari sebelumnya. */
function besok() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Pengingat yang pantas dikirim untuk penjemputan pada satu tanggal.
 *
 * Hanya MENGHITUNG daftarnya — pengirimannya (WhatsApp/email) menyusul di
 * task layanan notifikasi. Dipisah begitu supaya aturan "siapa yang
 * diingatkan" bisa diperiksa tanpa mengirim pesan ke siapa pun.
 *
 * Yang dilewati, berurutan sesuai sebabnya:
 * - penjemputan yang tidak lagi menunggu (sudah dijemput, selesai, batal);
 * - penjemputan satuan — pengingat ini milik jadwal rutin;
 * - jadwal yang pengingatnya dimatikan warga;
 * - jadwal yang DIJEDA dan tanggalnya jatuh di dalam rentang jeda.
 *
 * Catatan penting soal jeda: `is_paused` saja tidak cukup. Jeda berbatas
 * ("2 minggu") menyisakan penjemputan SETELAH jeda berakhir, dan warga tetap
 * harus diingatkan untuk yang itu — kalau tidak, menjeda sekali berarti
 * kehilangan pengingat sampai ia ingat menyalakannya sendiri. Karena itu yang
 * dibandingkan tanggalnya, bukan penandanya.
 */
export async function pengingatUntuk(
  db: Db,
  tanggal: string = besok(),
): Promise<Pengingat[]> {
  const baris = await db
    .select({
      pickupId: pickups.id,
      code: pickups.code,
      penggunaId: users.id,
      nama: users.fullName,
      nomor: users.phone,
      email: users.email,
      tanggal: pickups.pickupDate,
      jam: timeSlots.label,
      jamMulai: timeSlots.startTime,
      alamatLabel: addresses.label,
      alamatLengkap: addresses.fullAddress,
      jenis: sql<string[]>`coalesce(
        array_agg(distinct ${wasteCategories.slug}) filter (
          where ${wasteCategories.slug} is not null
        ), '{}'
      )`,
    })
    .from(pickups)
    .innerJoin(
      recurringSchedules,
      eq(pickups.recurringScheduleId, recurringSchedules.id),
    )
    .innerJoin(users, eq(pickups.userId, users.id))
    .innerJoin(addresses, eq(pickups.addressId, addresses.id))
    .innerJoin(timeSlots, eq(pickups.timeSlotId, timeSlots.id))
    .leftJoin(
      recurringScheduleItems,
      eq(recurringScheduleItems.scheduleId, recurringSchedules.id),
    )
    .leftJoin(
      wasteCategories,
      eq(recurringScheduleItems.categoryId, wasteCategories.id),
    )
    .where(
      and(
        eq(pickups.pickupDate, tanggal),
        eq(pickups.status, "menunggu"),
        eq(recurringSchedules.reminderEnabled, true),
        /* Lewati jadwal yang dijeda — kecuali tanggalnya sudah di luar
           rentang jeda, saat jadwalnya memang jalan lagi. */
        or(
          eq(recurringSchedules.isPaused, false),
          and(
            sql`${recurringSchedules.pausedUntil} is not null`,
            sql`${recurringSchedules.pausedUntil} < ${tanggal}`,
          ),
        ),
        /* Di luar masa berlaku jadwal, petugas juga tidak datang. */
        sql`${recurringSchedules.startDate} <= ${tanggal}`,
        or(
          isNull(recurringSchedules.endDate),
          sql`${recurringSchedules.endDate} >= ${tanggal}`,
        ),
      ),
    )
    .groupBy(
      pickups.id,
      users.id,
      addresses.id,
      timeSlots.id,
    )
    .orderBy(asc(timeSlots.startTime), asc(users.fullName));

  return baris.map(({ jamMulai, ...p }) => p);
}
