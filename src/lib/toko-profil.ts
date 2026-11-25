"use client";

import { useSyncExternalStore } from "react";
import { ADDRESSES, PENGGUNA } from "./mock";
import type { Address } from "./types";

/**
 * Profil & alamat tersimpan selama satu sesi — pola yang sama dengan
 * toko-jadwal: hasil ubah langsung terlihat di halaman profil, hilang saat
 * dimuat ulang. Ditukar dengan panggilan API saat backend-nya siap.
 */

export type Akun = typeof PENGGUNA;
export type Profil = { akun: Akun; alamat: Address[] };

/**
 * Alamat utama selalu tepat satu (selama ada alamat): pesanan baru memakai
 * alamat ini, jadi "tidak ada" atau "dua sekaligus" sama-sama membingungkan.
 * `utamaId` = alamat yang baru saja ditandai utama, menang atas yang lama.
 */
export function rapikanUtama(alamat: Address[], utamaId?: string): Address[] {
  const pilih = utamaId ?? alamat.find((a) => a.isDefault)?.id ?? alamat[0]?.id;
  return alamat.map((a) => ({ ...a, isDefault: a.id === pilih }));
}

export function gantiAlamat(alamat: Address[], a: Address): Address[] {
  const baru = alamat.some((x) => x.id === a.id)
    ? alamat.map((x) => (x.id === a.id ? a : x))
    : [...alamat, a];
  return rapikanUtama(baru, a.isDefault ? a.id : undefined);
}

export const buangAlamat = (alamat: Address[], id: string) =>
  rapikanUtama(alamat.filter((a) => a.id !== id));

const AWAL: Profil = { akun: PENGGUNA, alamat: ADDRESSES };
let profil = AWAL;
const pendengar = new Set<() => void>();

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => pendengar.delete(dengar);
}

function ganti(baru: Profil) {
  profil = baru;
  for (const dengar of pendengar) dengar();
}

export const ubahAkun = (akun: Partial<Akun>) =>
  ganti({ ...profil, akun: { ...profil.akun, ...akun } });

export const simpanAlamat = (a: Address) =>
  ganti({ ...profil, alamat: gantiAlamat(profil.alamat, a) });

export const hapusAlamat = (id: string) =>
  ganti({ ...profil, alamat: buangAlamat(profil.alamat, id) });

export function useProfil(): Profil {
  return useSyncExternalStore(
    langgan,
    () => profil,
    () => AWAL,
  );
}
