"use client";

import { useSyncExternalStore } from "react";
import type { PickupStatus } from "./types";

/**
 * Status pesanan yang berubah sendiri.
 *
 * Di produksi ini datang dari Supabase Realtime: petugas menekan "berangkat"
 * di aplikasinya, dan layar warga ikut berubah tanpa perlu dimuat ulang.
 * Sampai saluran itu ada, perubahannya ditiru di sini supaya layar yang
 * menampilkannya bisa benar-benar diuji — bukan hanya dibayangkan.
 *
 * Satu modul, satu timer: berapa pun komponen yang menonton, status hanya
 * maju sekali per langkah.
 */

const LANGKAH: PickupStatus[] = ["menunggu", "dijemput", "selesai"];

/** Jeda antar langkah. Cukup lama untuk dibaca, cukup cepat untuk diuji. */
const JEDA_MS = 6000;

type Peta = Readonly<Record<string, PickupStatus>>;

let ubahan: Peta = {};
let diamati: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const pendengar = new Set<() => void>();

const baca = () => ubahan;
const bacaServer = () => KOSONG;
const KOSONG: Peta = {};

function siarkan() {
  for (const dengar of pendengar) dengar();
}

function maju() {
  if (!diamati) return;
  const sekarang = ubahan[diamati] ?? "menunggu";
  const i = LANGKAH.indexOf(sekarang);
  if (i < 0 || i >= LANGKAH.length - 1) {
    hentikan();
    return;
  }
  ubahan = { ...ubahan, [diamati]: LANGKAH[i + 1] };
  siarkan();
}

function hentikan() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Mulai menjalankan simulasi untuk satu pesanan. */
export function mulaiSimulasi(pickupId: string, dariStatus: PickupStatus) {
  hentikan();
  diamati = pickupId;
  ubahan = { ...ubahan, [pickupId]: dariStatus };
  siarkan();
  timer = setInterval(maju, JEDA_MS);
}

export function setelSimulasi(pickupId: string, status: PickupStatus) {
  hentikan();
  diamati = pickupId;
  ubahan = { ...ubahan, [pickupId]: status };
  siarkan();
  if (status !== "selesai" && status !== "batal") {
    timer = setInterval(maju, JEDA_MS);
  }
}

export function hentikanSimulasi() {
  hentikan();
  diamati = null;
}

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => {
    pendengar.delete(dengar);
    if (pendengar.size === 0) hentikan();
  };
}

/** Status terkini satu pesanan — `asal` dipakai sampai simulasi menyentuhnya. */
export function useStatusLangsung(
  pickupId: string,
  asal: PickupStatus,
): PickupStatus {
  const peta = useSyncExternalStore(langgan, baca, bacaServer);
  return peta[pickupId] ?? asal;
}

export const jedaSimulasiMs = JEDA_MS;
