import Link from "next/link";
import { tanggalPendek } from "@/lib/tanggal";
import type { RecurringSchedule } from "@/lib/types";
import { TombolLink } from "./tombol";
import { IkonJadwal } from "./ikon";
import { RingkasanRutin } from "./jadwal/ringkasan-rutin";
import { TogglePengingat } from "./jadwal/toggle-pengingat";
import { ChipSampah, Kartu } from "./primitif";

const HARI_PENDEK: Record<string, string> = {
  Senin: "Sen",
  Selasa: "Sel",
  Rabu: "Rab",
  Kamis: "Kam",
  Jumat: "Jum",
  Sabtu: "Sab",
  Minggu: "Min",
};

const URUTAN = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

/**
 * Aturan jadwal rutin, bukan satu penjemputan. Minggu digambar sebagai tujuh
 * kotak dengan hari terpilih ditandai — warga bisa membaca polanya sekali
 * lihat, tanpa menerjemahkan daftar nama hari.
 */
export function KartuRutin({
  jadwal,
  nomor,
}: {
  jadwal: RecurringSchedule | null;
  nomor: string;
}) {
  if (!jadwal)
    return (
      <Kartu className="p-5 text-center">
        <p className="text-[15px] font-semibold">Belum ada jadwal rutin</p>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">
          Pilih hari dan jam sekali, petugas datang sendiri setiap minggu.
        </p>
        <div className="mt-4">
          <TombolLink href="/jadwal/atur" lebar>
            Atur jadwal rutin
          </TombolLink>
        </div>
      </Kartu>
    );
  const alamat = jadwal.address;
  const slot = jadwal.slot;
  const dijeda = jadwal.isPaused;

  return (
    <Kartu className={dijeda ? "border-line-kuat bg-paper" : ""}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-2">Jadwal rutin</p>
            <p className="angka mt-0.5 text-[20px] font-extrabold leading-tight">
              {slot?.range}
            </p>
          </div>
          {dijeda ? (
            <span className="shrink-0 rounded-kartu border border-line-kuat bg-card px-2 py-0.5 text-[12px] font-semibold text-ink-2">
              Dijeda
            </span>
          ) : (
            <span className="shrink-0 rounded-kartu border border-hijau/40 bg-hijau-tipis px-2 py-0.5 text-[12px] font-semibold text-hijau">
              Berjalan
            </span>
          )}
        </div>

        <ul className="mt-3 flex gap-1" aria-label="Hari penjemputan">
          {URUTAN.map((h) => {
            const aktif = jadwal.days.includes(h as never);
            return (
              <li
                key={h}
                aria-label={`${h}${aktif ? ", dijemput" : ", tidak dijemput"}`}
                className={`flex h-9 flex-1 items-center justify-center rounded-kartu border text-[12px] font-semibold ${
                  aktif && !dijeda
                    ? "border-hijau bg-hijau text-white"
                    : aktif
                      ? "border-line-kuat bg-card text-ink-2"
                      : "border-line bg-paper text-ink-3"
                }`}
              >
                {HARI_PENDEK[h]}
              </li>
            );
          })}
        </ul>

        <div className="mt-3">
          <RingkasanRutin jadwal={jadwal} tampilkanJam={false} />
        </div>

        <p className="mt-2 text-[13px] leading-snug text-ink-3">
          {alamat?.fullAddress}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {jadwal.categories.map((k) => (
            <ChipSampah key={k} jenis={k} ukuran="sm" />
          ))}
        </div>

        {dijeda && jadwal.pausedUntil && (
          <p className="mt-3 rounded-kartu border border-line bg-card p-2.5 text-[13px] leading-snug text-ink-2">
            Dijeda sampai {tanggalPendek(jadwal.pausedUntil)}. Setelah itu
            penjemputan jalan lagi sendiri.
          </p>
        )}

        <div className="mt-3">
          <TogglePengingat
            jadwalId={jadwal.id}
            awal={jadwal.reminderEnabled}
            nomor={nomor}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <Link
            href="/jadwal/atur"
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-kartu border border-line-kuat bg-card text-[14px] font-semibold hover:bg-paper"
          >
            <IkonJadwal className="size-4" />
            Ubah jadwal
          </Link>
          <Link
            href="/jadwal/jeda"
            className="flex min-h-11 flex-1 items-center justify-center rounded-kartu border border-line-kuat bg-card text-[14px] font-semibold hover:bg-paper"
          >
            {dijeda ? "Jalankan lagi" : "Jeda sementara"}
          </Link>
        </div>
      </div>
    </Kartu>
  );
}
