"use client";

import { useSyncExternalStore } from "react";
import { CHANNELS, diskusiByChannel } from "./mock";
import type { ChannelThread } from "./types";

/**
 * Papan diskusi selama satu sesi.
 *
 * Warga yang baru menulis harus melihat tulisannya langsung — kalau tidak, ia
 * akan menekan kirim dua kali. Tanpa backend, utas dan balasan disimpan di
 * modul ini dan disiarkan lewat useSyncExternalStore; hilang saat halaman
 * dimuat ulang, dan itu memang yang diharapkan dari data tiruan.
 *
 * Saat API-nya siap, berkas ini ditukar dengan panggilan ke
 * `/api/channel/:id/diskusi` tanpa menyentuh komponen yang memakainya.
 */

type Papan = Readonly<Record<string, ChannelThread[]>>;

/* Disemai sekali saat modul dimuat, bukan saat dibaca: getSnapshot harus
   mengembalikan referensi yang sama selama isinya belum berubah. */
const AWAL: Papan = Object.fromEntries(
  CHANNELS.map((c) => [c.id, diskusiByChannel(c.id)]),
);

let papan: Papan = AWAL;
const pendengar = new Set<() => void>();
const KOSONG: ChannelThread[] = [];

function siarkan() {
  for (const dengar of pendengar) dengar();
}

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => pendengar.delete(dengar);
}

/* Penulis tulisan baru. Nama aslinya menyusul bersama halaman profil. */
const AKU = "Kamu";

/** Id yang cukup unik untuk satu sesi — tidak ada basis data yang menilainya. */
const idBaru = (awalan: string) =>
  `${awalan}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Utas baru naik ke puncak papan channel itu. */
export function kirimUtas(channelId: string, isi: string) {
  const utas: ChannelThread = {
    id: idBaru("ut"),
    channelId,
    author: AKU,
    content: isi,
    agoDays: 0,
    replies: [],
  };
  papan = { ...papan, [channelId]: [utas, ...(papan[channelId] ?? [])] };
  siarkan();
}

/** Balasan ditambahkan di akhir utasnya — urutan percakapan, bukan terbaru. */
export function kirimBalasan(channelId: string, utasId: string, isi: string) {
  const daftar = papan[channelId];
  if (!daftar) return;
  papan = {
    ...papan,
    [channelId]: daftar.map((u) =>
      u.id === utasId
        ? {
            ...u,
            replies: [
              ...u.replies,
              { id: idBaru("bl"), author: AKU, content: isi, agoDays: 0 },
            ],
          }
        : u,
    ),
  };
  siarkan();
}

export function useDiskusi(channelId: string): ChannelThread[] {
  return useSyncExternalStore(
    langgan,
    () => papan[channelId] ?? KOSONG,
    () => AWAL[channelId] ?? KOSONG,
  );
}

export const namaPenulis = AKU;
