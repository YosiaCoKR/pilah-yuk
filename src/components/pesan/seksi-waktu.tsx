"use client";

import { useEffect, useRef } from "react";
import { useNilaiKlien } from "@/lib/klien";
import { TIME_SLOTS } from "@/lib/mock";
import {
  hariPendek,
  jarakHari,
  parseISO,
  railHari,
  tanggalPanjang,
} from "@/lib/tanggal";
import { IkonJam } from "../ikon";
import { Label } from "../primitif";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function SeksiWaktu({
  tanggal,
  slot,
  onTanggal,
  onSlot,
}: {
  tanggal: string | null;
  slot: string | null;
  onTanggal: (iso: string) => void;
  onSlot: (id: string) => void;
}) {
  /* Which days are offered depends on today, so the rail is empty during
     prerender. Placeholder cells hold the exact same box to avoid a jump. */
  const hari = useNilaiKlien(() => railHari(21), KOSONG);

  const rail = useRef<HTMLUListElement>(null);

  /* Keep the chosen day in view when it is far down the rail. */
  useEffect(() => {
    rail.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [tanggal]);

  const bulanTampil = tanggal
    ? `${BULAN[parseISO(tanggal).getMonth()]} ${parseISO(tanggal).getFullYear()}`
    : hari.length
      ? `${BULAN[parseISO(hari[0]).getMonth()]} ${parseISO(hari[0]).getFullYear()}`
      : "";

  return (
    <section className="space-y-3">
      <Label
        aksi={
          bulanTampil ? (
            <span className="text-[13px] font-medium text-ink-2">
              {bulanTampil}
            </span>
          ) : undefined
        }
      >
        Waktu jemput
      </Label>

      <ul
        ref={rail}
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1"
      >
        {hari.length === 0 &&
          Array.from({ length: 7 }, (_, i) => (
            <li key={i} aria-hidden>
              <span className="block min-h-[76px] w-14 rounded-kartu border border-line bg-card" />
            </li>
          ))}
        {hari.map((iso) => {
          const aktif = iso === tanggal;
          const d = parseISO(iso);
          const akhirPekan = d.getDay() === 0;
          return (
            <li key={iso} className="snap-start">
              <button
                type="button"
                onClick={() => onTanggal(iso)}
                aria-pressed={aktif}
                aria-label={tanggalPanjang(iso)}
                className={`flex min-h-[76px] w-14 flex-col items-center justify-center gap-0.5 rounded-kartu border ${
                  aktif
                    ? "border-hijau bg-hijau text-white"
                    : "border-line bg-card hover:border-line-kuat"
                }`}
              >
                <span
                  className={`text-[11px] font-semibold ${
                    aktif
                      ? "text-white/80"
                      : akhirPekan
                        ? "text-alarm"
                        : "text-ink-3"
                  }`}
                >
                  {hariPendek(iso)}
                </span>
                <span className="angka text-[20px] font-bold leading-none">
                  {String(d.getDate()).padStart(2, "0")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {tanggal && (
        <p className="text-[13px] text-ink-2">
          {tanggalPanjang(tanggal)}
          <KapanLagi iso={tanggal} />
        </p>
      )}

      <ul className="space-y-2">
        {TIME_SLOTS.map((s) => {
          const aktif = s.id === slot;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={s.full}
                onClick={() => onSlot(s.id)}
                aria-pressed={aktif}
                className={`flex w-full items-center gap-3 rounded-kartu border p-3 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
                  aktif
                    ? "border-hijau bg-hijau-tipis"
                    : "border-line bg-card enabled:hover:border-line-kuat"
                }`}
              >
                <IkonJam
                  className={`size-5 shrink-0 ${aktif ? "text-hijau" : "text-ink-3"}`}
                />
                <span className="angka flex-1 text-[16px] font-bold">
                  {s.range}
                </span>
                <span
                  className={`text-[12px] ${s.full ? "font-semibold text-alarm" : "text-ink-2"}`}
                >
                  {s.note}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-[13px] leading-snug text-ink-3">
        Petugas datang di rentang jam itu. Siapkan sampah di depan rumah
        sebelum jam mulai.
      </p>
    </section>
  );
}

/** " · besok" — client-only, since it depends on today. */
function KapanLagi({ iso }: { iso: string }) {
  const teks = useNilaiKlien(() => jarakHari(iso), null);
  return teks ? <span className="font-semibold text-hijau"> · {teks}</span> : null;
}

/** Stable empty snapshot for the prerendered rail. */
const KOSONG: string[] = [];
