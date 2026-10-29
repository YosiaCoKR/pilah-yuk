import type { PickupStatus } from "@/lib/types";

const URUTAN: { kunci: PickupStatus; judul: string; jelas: string }[] = [
  {
    kunci: "menunggu",
    judul: "Menunggu dijemput",
    jelas: "Petugas channel sudah menerima permintaanmu.",
  },
  {
    kunci: "dijemput",
    judul: "Petugas berangkat",
    jelas: "Sampah diambil dan ditimbang di tempat.",
  },
  {
    kunci: "selesai",
    judul: "Selesai",
    jelas: "Berat dan bukti pengangkutan masuk ke riwayat.",
  },
];

/**
 * Three steps, vertical. Numbered markers would be wrong here — this is a
 * real sequence, but the *position* already encodes the order, so the marker
 * carries state instead: filled for done, ringed for now, hollow for later.
 */
export function LiniStatus({ sekarang }: { sekarang: PickupStatus }) {
  const indeks = URUTAN.findIndex((s) => s.kunci === sekarang);
  /* "selesai" adalah akhir perjalanan, bukan langkah yang sedang berjalan —
     jadi langkah terakhir ditandai tuntas, bukan diberi cincin "sekarang". */
  const tuntas = sekarang === "selesai";

  return (
    <ol className="space-y-0">
      {URUTAN.map((s, i) => {
        const lewat = i < indeks || (tuntas && i === indeks);
        const kini = i === indeks && !tuntas;
        const akhir = i === URUTAN.length - 1;
        return (
          <li key={s.kunci} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={`mt-1 size-3 shrink-0 rounded-full border-2 ${
                  lewat
                    ? "border-hijau bg-hijau"
                    : kini
                      ? "border-hijau bg-card ring-4 ring-hijau-tipis"
                      : "border-line-kuat bg-card"
                }`}
              />
              {!akhir && (
                <span
                  aria-hidden
                  className={`w-0.5 flex-1 ${lewat ? "bg-hijau" : "bg-line"}`}
                />
              )}
            </div>
            <div className={akhir ? "pb-0" : "pb-5"}>
              <p
                className={`text-[14px] font-semibold ${
                  kini || lewat ? "text-ink" : "text-ink-3"
                }`}
              >
                {s.judul}
                {kini && (
                  <span className="ml-2 rounded-kartu border border-hijau/40 bg-hijau-tipis px-1.5 py-px text-[11px] text-hijau">
                    sekarang
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
                {s.jelas}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
