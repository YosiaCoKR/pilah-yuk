import { WASTE_COLOR, categoryByKey } from "@/lib/mock";
import type { WasteKey } from "@/lib/types";
import { Kartu } from "../primitif";

const kg = (n: number) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/**
 * Rincian jenis sampah satu pengangkutan.
 *
 * Batang proporsi memakai warna tong — di sini warna memang DATA-nya, bukan
 * hiasan: tiap potongan adalah satu kategori, dan panjangnya adalah bagiannya.
 *
 * Petugas menimbang sekali untuk semua karung, jadi berat per jenis tidak
 * pernah benar-benar diketahui. Angkanya disebut perkiraan, dengan tanda ±,
 * daripada memberi warga ketelitian yang tidak ada.
 */
export function RincianSampah({
  jenis,
  totalKg,
}: {
  jenis: WasteKey[];
  totalKg: number;
}) {
  const bagian = totalKg / jenis.length;

  return (
    <Kartu className="overflow-hidden">
      <div className="p-4 pb-3">
        <div
          className="flex h-3 overflow-hidden rounded-full"
          role="img"
          aria-label={`Komposisi: ${jenis
            .map((k) => categoryByKey(k).name)
            .join(", ")}`}
        >
          {jenis.map((k) => (
            <span
              key={k}
              className="h-full"
              style={{
                width: `${100 / jenis.length}%`,
                background: WASTE_COLOR[k],
              }}
            />
          ))}
        </div>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {jenis.map((k) => {
          const kategori = categoryByKey(k);
          return (
            <li key={k} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: WASTE_COLOR[k] }}
                  />
                  <span className="truncate text-[15px] font-semibold">
                    {kategori.name}
                  </span>
                </span>
                <span className="angka shrink-0 text-[14px] font-bold text-ink-2">
                  ± {kg(bagian)} kg
                </span>
              </div>
              <p className="mt-1 pl-[22px] text-[13px] leading-snug text-ink-3">
                {kategori.description}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-paper p-3">
        <span className="text-[14px] font-bold">Total timbangan</span>
        <span className="angka text-[16px] font-extrabold">
          {kg(totalKg)} kg
        </span>
      </div>
    </Kartu>
  );
}
