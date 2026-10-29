"use client";

import { useId } from "react";

/**
 * Sakelar hidup/mati.
 *
 * Dibangun di atas `<input type="checkbox">` yang disembunyikan secara visual,
 * bukan `<div role="switch">` — jadi keyboard, pembaca layar, dan label yang
 * bisa ditekan datang dari platform, bukan ditiru ulang.
 */
export function Sakelar({
  nyala,
  onUbah,
  judul,
  keterangan,
  matikanKeterangan,
}: {
  nyala: boolean;
  onUbah: (nyala: boolean) => void;
  judul: string;
  /** Dibaca saat sakelar menyala. */
  keterangan: string;
  /** Dibaca saat mati — menjelaskan akibatnya, bukan sekadar "nonaktif". */
  matikanKeterangan: string;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-kartu border border-line bg-card p-3"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{judul}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">
          {nyala ? keterangan : matikanKeterangan}
        </span>
      </span>

      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={nyala}
        onChange={(e) => onUbah(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hijau ${
          nyala ? "border-hijau bg-hijau" : "border-line-kuat bg-paper"
        }`}
      >
        <span
          className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-card shadow-sm transition-[left] ${
            nyala ? "left-[22px]" : "left-[3px]"
          }`}
        />
      </span>
    </label>
  );
}
