"use client";

import { useSyncExternalStore } from "react";
import { RECURRING } from "./mock";
import type { RecurringSchedule } from "./types";

/**
 * Keadaan jadwal rutin selama satu sesi.
 *
 * Menjeda jadwal harus terlihat di layar lain juga — kartu di halaman jadwal
 * ikut berubah begitu aksinya dijalankan. Tanpa backend, keadaannya disimpan
 * di modul ini dan disiarkan lewat useSyncExternalStore. Hilang saat halaman
 * dimuat ulang, dan itu memang yang diharapkan dari data tiruan.
 *
 * Saat API-nya siap, berkas ini ditukar dengan panggilan ke `/api/jadwal`
 * tanpa menyentuh komponen yang memakainya.
 */

let jadwal: RecurringSchedule = RECURRING;
const pendengar = new Set<() => void>();

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => pendengar.delete(dengar);
}

/* Referensi objek hanya berubah saat isinya berubah — syarat snapshot yang
   stabil, kalau tidak React akan merender tanpa henti. */
const baca = () => jadwal;
const bacaServer = () => RECURRING;

export function ubahJadwal(sebagian: Partial<RecurringSchedule>) {
  jadwal = { ...jadwal, ...sebagian };
  for (const dengar of pendengar) dengar();
}

export const jedaJadwal = (sampai: string | null) =>
  ubahJadwal({ isPaused: true, pausedUntil: sampai });

export const jalankanJadwal = () =>
  ubahJadwal({ isPaused: false, pausedUntil: null });

export function useJadwal(): RecurringSchedule {
  return useSyncExternalStore(langgan, baca, bacaServer);
}
