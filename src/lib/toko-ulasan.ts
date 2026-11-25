"use client";

import { useSyncExternalStore } from "react";
import { ULASAN } from "./mock";
import type { Ulasan } from "./types";

/**
 * Penilaian yang dikirim selama satu sesi — pola yang sama dengan
 * toko-jadwal & toko-profil. Satu penjemputan hanya punya satu penilaian;
 * mengirim lagi menimpa yang lama.
 */

let ulasan: Ulasan[] = ULASAN;
const pendengar = new Set<() => void>();

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => pendengar.delete(dengar);
}

export function simpanUlasan(u: Ulasan) {
  ulasan = [u, ...ulasan.filter((x) => x.pickupId !== u.pickupId)];
  for (const dengar of pendengar) dengar();
}

export function useUlasan(): Ulasan[] {
  return useSyncExternalStore(
    langgan,
    () => ulasan,
    () => ULASAN,
  );
}
