import { kirim } from "./kirim";
import type { RecurringSchedule } from "./types";

/**
 * Aksi jadwal rutin ke API. Keadaan tidak disimpan di sini: setelah aksi,
 * layar pindah/refresh dan Server Component membaca ulang dari API.
 */

export type IsiRutin = Pick<
  RecurringSchedule,
  "addressId" | "timeSlotId" | "days" | "categories" | "reminderEnabled"
>;

/** `id` null = jadwal baru. */
export const simpanJadwal = (id: string | null, isi: IsiRutin) =>
  kirim(
    id ? "PUT" : "POST",
    id ? `/api/jadwal/rutin/${id}` : "/api/jadwal/rutin",
    {
      addressId: isi.addressId,
      timeSlotId: isi.timeSlotId,
      hari: isi.days,
      jenis: isi.categories,
      pengingat: isi.reminderEnabled,
    },
  );

export const jedaJadwal = (id: string, sampai: string | null) =>
  kirim<{ dibatalkan: number }>("PUT", `/api/jadwal/rutin/${id}/jeda`, {
    sampai,
  });

export const jalankanJadwal = (id: string) =>
  kirim("PUT", `/api/jadwal/rutin/${id}/jalan`);

export const aturPengingat = (id: string, aktif: boolean) =>
  kirim("PUT", `/api/jadwal/rutin/${id}/pengingat`, { aktif });
