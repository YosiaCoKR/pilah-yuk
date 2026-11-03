"use client";

import Link from "next/link";
import { useNilaiKlien } from "@/lib/klien";
import { TIPS_PILAH, WASTE_COLOR, categoryByKey, tipHari } from "@/lib/mock";
import { hariIniISO } from "@/lib/tanggal";

/**
 * Tip pilah hari ini.
 *
 * Dibaca lewat `useNilaiKlien` karena halaman panduan dipranyalakan dan
 * di-cache: tanggal saat build akan membekukan tipnya di situ selamanya, dan
 * "tips harian" yang tidak pernah berganti bukan tips harian.
 *
 * ponytail: lukisan pertama memakai tip pertama sebagai sandaran, lalu
 * berganti ke tip hari ini setelah hidrasi — jadi ada satu kali pergantian
 * teks. Keduanya tip yang utuh, jadi tidak ada keadaan setengah jadi yang
 * terbaca. Kalau pergantian itu mengganggu, halamannya dijadikan dinamis
 * (atau di-revalidate harian) dan tipnya dirakit di server.
 */
export function TipsHarian() {
  /* TIPS_PILAH[0] dan hasil tipHari sama-sama elemen array tingkat modul,
     jadi rujukannya tetap antar panggilan — syarat useSyncExternalStore. */
  const tip = useNilaiKlien(() => tipHari(hariIniISO()), TIPS_PILAH[0]);
  const kategori = categoryByKey(tip.jenis);

  return (
    <Link
      href={`/panduan/${tip.jenis}`}
      className="block rounded-kartu border border-line bg-card p-3 hover:border-line-kuat"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-[7px] size-2.5 shrink-0 rounded-full"
          style={{ background: WASTE_COLOR[tip.jenis] }}
        />
        <div className="min-w-0 flex-1">
          {/* Bendanya disebut di depan kalau tipnya berangkat dari satu benda:
              "Styrofoam — terlihat seperti plastik…" langsung terbaca sebagai
              jawaban, sementara catatannya sendiri menggantung tanpa subjek. */}
          <p className="text-[14px] leading-snug">
            {tip.benda && (
              <span className="font-semibold">
                {tip.benda.charAt(0).toUpperCase() + tip.benda.slice(1)}:{" "}
              </span>
            )}
            {tip.teks}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            Tips hari ini untuk {kategori.name.toLowerCase()}
          </p>
        </div>
      </div>
    </Link>
  );
}
