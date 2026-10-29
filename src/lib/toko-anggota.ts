"use client";

import { useSyncExternalStore } from "react";
import { CHANNELS, anggotaByChannel } from "./mock";
import type { ChannelMember } from "./types";

/**
 * Daftar anggota channel selama satu sesi.
 *
 * Menyetujui atau mengeluarkan anggota harus langsung terlihat — pengurus
 * memproses permintaan berurutan dan butuh tahu mana yang sudah ditangani.
 * Tanpa backend, keadaannya disimpan di modul ini dan disiarkan lewat
 * useSyncExternalStore; hilang saat halaman dimuat ulang.
 *
 * Saat API-nya siap, berkas ini ditukar dengan panggilan ke
 * `/api/channel/:id/anggota` tanpa menyentuh komponen yang memakainya.
 */

type Daftar = Readonly<Record<string, ChannelMember[]>>;

/* Disemai sekali saat modul dimuat: getSnapshot wajib mengembalikan referensi
   yang sama selama isinya belum berubah. */
const AWAL: Daftar = Object.fromEntries(
  CHANNELS.map((c) => [c.id, anggotaByChannel(c.id)]),
);

let daftar: Daftar = AWAL;
const pendengar = new Set<() => void>();
const KOSONG: ChannelMember[] = [];

function tulis(channelId: string, ubah: (xs: ChannelMember[]) => ChannelMember[]) {
  const sekarang = daftar[channelId];
  if (!sekarang) return;
  daftar = { ...daftar, [channelId]: ubah(sekarang) };
  for (const dengar of pendengar) dengar();
}

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => pendengar.delete(dengar);
}

/** Permintaan gabung diterima: anggota pindah ke daftar aktif hari ini. */
export const setujuiAnggota = (channelId: string, id: string) =>
  tulis(channelId, (xs) =>
    xs.map((a) =>
      a.id === id ? { ...a, status: "aktif" as const, agoDays: 0 } : a,
    ),
  );

/** Permintaan ditolak, atau anggota dikeluarkan — keduanya hilang dari daftar. */
export const hapusAnggota = (channelId: string, id: string) =>
  tulis(channelId, (xs) => xs.filter((a) => a.id !== id));

export function useAnggota(channelId: string): ChannelMember[] {
  return useSyncExternalStore(
    langgan,
    () => daftar[channelId] ?? KOSONG,
    () => AWAL[channelId] ?? KOSONG,
  );
}
