"use client";

import { useNilaiKlien } from "@/lib/klien";
import { jarakHari } from "@/lib/tanggal";

/**
 * "besok" / "2 hari lagi". Client-only because it depends on today's date.
 * Space is reserved so the ticket header does not shift when it appears.
 */
export function JarakHari({ iso }: { iso: string }) {
  const teks = useNilaiKlien(() => jarakHari(iso), null);

  return (
    <span className="block min-h-[18px] text-[13px] font-semibold text-hijau">
      {teks}
    </span>
  );
}
