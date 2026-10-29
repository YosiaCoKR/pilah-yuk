import { Kartu } from "../primitif";

/** "Pak Dedi" → "PD". Dua huruf cukup untuk dikenali di daftar. */
function inisial(nama: string) {
  return nama
    .split(" ")
    .filter((w) => !/^(pak|bu|bapak|ibu|mas|mbak)$/i.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Petugas yang mengangkut. Diberi nama dan wajah, bukan sekadar baris data —
 * yang datang ke rumah warga adalah tetangga sekampung, dan di situlah
 * kepercayaan terhadap layanan ini terbentuk.
 */
export function KartuPetugas({
  nama,
  channel,
  jumlahAngkut,
}: {
  nama: string;
  channel?: string;
  /** Berapa kali petugas ini sudah mengangkut untuk warga tersebut. */
  jumlahAngkut?: number;
}) {
  return (
    <Kartu className="flex items-center gap-3 p-4">
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-full border border-line-kuat bg-paper text-[16px] font-bold text-ink-2"
      >
        {inisial(nama)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{nama}</p>
        {channel && (
          <p className="text-[13px] leading-snug text-ink-2">{channel}</p>
        )}
        {jumlahAngkut !== undefined && jumlahAngkut > 1 && (
          <p className="mt-0.5 text-[13px] text-ink-3">
            Sudah {jumlahAngkut} kali mengangkut di alamatmu.
          </p>
        )}
      </div>
    </Kartu>
  );
}
