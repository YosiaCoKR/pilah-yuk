import Link from "next/link";
import { addressById, slotById } from "@/lib/mock";
import { bulanPendekDari, hariPendek, parseISO } from "@/lib/tanggal";
import { StatusJemput } from "./status-jemput";
import type { Pickup } from "@/lib/types";
import { JarakHari } from "./jarak-hari";
import { IkonLanjut } from "./ikon";
import { ChipSampah } from "./primitif";

/**
 * Satu baris jadwal. Bukan struk penuh — perforasi disimpan untuk kartu hero
 * agar tetap berarti. Di sini tanggal berdiri sebagai talang kiri, cara agenda
 * dan kalender dinding dibaca.
 */
export function BarisJadwal({
  pickup,
  tampilkanJarak = false,
}: {
  pickup: Pickup;
  tampilkanJarak?: boolean;
}) {
  const alamat = addressById(pickup.addressId);
  const slot = slotById(pickup.timeSlotId);
  const d = parseISO(pickup.pickupDate);

  return (
    <Link
      href={`/jadwal/${pickup.id}`}
      className="flex items-stretch gap-0 overflow-hidden rounded-kartu border border-line bg-card hover:border-line-kuat"
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-line bg-paper py-3">
        <span className="text-[11px] font-semibold text-ink-3">
          {hariPendek(pickup.pickupDate)}
        </span>
        <span className="angka text-[22px] font-extrabold leading-none">
          {String(d.getDate()).padStart(2, "0")}
        </span>
        <span className="text-[11px] text-ink-3">
          {bulanPendekDari(pickup.pickupDate)}
        </span>
      </div>

      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="angka text-[15px] font-bold">{slot?.range}</span>
          <StatusJemput status={pickup.status} ringkas />
        </div>

        <p className="mt-0.5 truncate text-[13px] text-ink-2">
          {alamat?.label} · {alamat?.fullAddress}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {pickup.categories.map((k) => (
            <ChipSampah key={k} jenis={k} ukuran="sm" />
          ))}
          {pickup.recurring && (
            <span className="rounded-kartu border border-line bg-paper px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
              Rutin
            </span>
          )}
        </div>

        {tampilkanJarak && <JarakHari iso={pickup.pickupDate} />}
      </div>

      <span className="flex items-center pr-2 text-ink-3" aria-hidden>
        <IkonLanjut className="size-5" />
      </span>
    </Link>
  );
}
