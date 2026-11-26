"use client";

import Link from "next/link";
import { useNilaiKlien } from "@/lib/klien";
import { salam } from "@/lib/kalimat";
import { Kartu } from "./primitif";

/** Salam menurut jam perangkat warga; "Halo," selama prerender. */
export function Salam() {
  const teks = useNilaiKlien(() => salam(new Date().getHours()), "Halo");
  return <p className="text-[13px] text-ink-2">{teks},</p>;
}

/**
 * Untuk pengurus: permintaan gabung yang belum dijawab. Memakai toko anggota
 * yang sama dengan halaman Kelola Anggota, jadi angkanya turun begitu
 * permintaan disetujui di sana.
 */
export function PermintaanGabung({
  channelId,
  n,
}: {
  channelId: string;
  /** Jumlah permintaan gabung yang belum diputus. */
  n: number;
}) {
  if (!n) return null;
  return (
    <Link href={`/channel/${channelId}/anggota`} className="block">
      <Kartu className="flex items-center justify-between gap-3 p-4 hover:border-line-kuat">
        <span>
          <span className="block text-[15px] font-semibold">
            {n} warga menunggu persetujuan
          </span>
          <span className="block text-[13px] leading-snug text-ink-2">
            Pesanan mereka belum bisa diteruskan ke petugas sebelum disetujui.
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-hijau">
          Tinjau
        </span>
      </Kartu>
    </Link>
  );
}
