import { jamPersis, kalimatRutin } from "@/lib/kalimat";
import type { RecurringSchedule } from "@/lib/types";

/**
 * Jadwal sebagai satu kalimat. Ini yang dibaca lebih dulu dari tabel hari
 * mana pun, jadi ia diberi ukuran yang pantas dibaca — bukan keterangan
 * kecil di bawah kisi.
 */
export function RingkasanRutin({
  jadwal,
  ukuran = "md",
  tampilkanJam = true,
}: {
  jadwal: RecurringSchedule;
  ukuran?: "sm" | "md";
  tampilkanJam?: boolean;
}) {
  const kecil = ukuran === "sm";

  return (
    <div>
      <p
        className={
          kecil
            ? "text-[14px] leading-snug"
            : "text-[16px] leading-relaxed text-balance"
        }
      >
        {jadwal.isPaused ? (
          <>
            <span className="font-semibold text-ink-2">Sedang dijeda. </span>
            <span className="text-ink-2">{kalimatRutin(jadwal)}</span>
          </>
        ) : (
          kalimatRutin(jadwal)
        )}
      </p>
      {tampilkanJam && jadwal.days.length > 0 && (
        <p
          className={`mt-1 text-ink-2 ${kecil ? "text-[12px]" : "text-[13px]"}`}
        >
          {jamPersis(jadwal)}
        </p>
      )}
    </div>
  );
}
