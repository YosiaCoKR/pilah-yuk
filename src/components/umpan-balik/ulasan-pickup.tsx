"use client";

import { useUlasan } from "@/lib/toko-ulasan";
import type { Ulasan } from "@/lib/types";
import { IkonBintang } from "../ikon";
import { Kartu } from "../primitif";
import { TombolLink } from "../tombol";

export const KATA_NILAI = [
  "",
  "Buruk",
  "Kurang",
  "Cukup",
  "Baik",
  "Sangat baik",
];

/** Bintang hanya-baca; angkanya ikut dibacakan untuk pembaca layar. */
export function BintangBaca({ nilai }: { nilai: number }) {
  return (
    <span
      className="inline-flex text-hijau"
      role="img"
      aria-label={`${nilai} dari 5 bintang`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <IkonBintang
          key={n}
          className={`size-4 ${n <= nilai ? "" : "text-line-kuat"}`}
          fill={n <= nilai ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

/** Isi satu penilaian: bintang, kata, tanda cepat, dan catatan. */
export function RingkasUlasan({ u }: { u: Ulasan }) {
  return (
    <>
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <BintangBaca nilai={u.nilai} />
        {KATA_NILAI[u.nilai]}
      </p>
      {u.tanda.length > 0 && (
        <p className="mt-1 text-[13px] text-ink-2">{u.tanda.join(" · ")}</p>
      )}
      {u.catatan && (
        <p className="mt-1 text-[14px] leading-snug">“{u.catatan}”</p>
      )}
    </>
  );
}

/**
 * Di detail riwayat: penilaian yang sudah dikirim, atau ajakan menilai.
 * Sengaja tidak menawarkan "nilai lagi" — satu penjemputan, satu penilaian.
 */
export function UlasanPickup({ pickupId }: { pickupId: string }) {
  const u = useUlasan().find((x) => x.pickupId === pickupId);
  if (!u) {
    return (
      <TombolLink href={`/umpan-balik/${pickupId}`} varian="garis" lebar>
        Nilai pelayanan petugas
      </TombolLink>
    );
  }
  return (
    <Kartu className="p-4">
      <p className="mb-2 text-[13px] text-ink-2">Penilaianmu</p>
      <RingkasUlasan u={u} />
    </Kartu>
  );
}
