"use client";

import { useSyncExternalStore } from "react";
import { ULASAN } from "./mock";
import type { Ulasan } from "./types";

/**
 * Penilaian yang dikirim selama satu sesi — pola yang sama dengan
 * toko-jadwal & toko-profil. Satu penjemputan hanya punya satu penilaian:
 * kiriman kedua ditolak, persis seperti server nanti menolaknya lewat
 * unique constraint, bukan diam-diam menimpa yang lama.
 */

/** null = penjemputan ini sudah dinilai; daftar tidak berubah. */
export const tambahUlasan = (daftar: Ulasan[], u: Ulasan): Ulasan[] | null =>
  daftar.some((x) => x.pickupId === u.pickupId) ? null : [u, ...daftar];

let ulasan: Ulasan[] = ULASAN;
const pendengar = new Set<() => void>();

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => pendengar.delete(dengar);
}

/** false = ditolak karena sudah pernah dinilai. */
export function simpanUlasan(u: Ulasan): boolean {
  const baru = tambahUlasan(ulasan, u);
  if (!baru) return false;
  ulasan = baru;
  for (const dengar of pendengar) dengar();
  return true;
}

export function useUlasan(): Ulasan[] {
  return useSyncExternalStore(
    langgan,
    () => ulasan,
    () => ULASAN,
  );
}
