import Link from "next/link";
import { addressById, slotById } from "@/lib/mock";
import { hariPanjang, tanggalPendek } from "@/lib/tanggal";
import { JarakHari } from "./jarak-hari";
import { StatusJemput } from "./status-jemput";
import type { Pickup } from "@/lib/types";
import { ChipSampah, Kartu, Perforasi } from "./primitif";

/**
 * The hero. A pickup rendered as a ticket stub: the perforation splits "when"
 * (top) from "what and where" (bottom), which is how a struk reads. Certainty
 * is the product's selling point, so it is given the largest type on screen.
 */
export function KartuJemput({ pickup }: { pickup: Pickup }) {
  const alamat = addressById(pickup.addressId);
  const slot = slotById(pickup.timeSlotId);

  return (
    <Kartu className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <p className="text-[13px] font-semibold text-ink-2">
            Jemput berikutnya
          </p>
          <p className="angka mt-1 text-[34px] font-extrabold leading-[1.05]">
            {hariPanjang(pickup.pickupDate)}
          </p>
          <p className="angka text-[20px] font-bold leading-tight text-ink-2">
            {tanggalPendek(pickup.pickupDate)} · {slot?.range}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <StatusJemput status={pickup.status} ringkas />
          <span className="mt-1.5 block">
            <JarakHari iso={pickup.pickupDate} />
          </span>
        </div>
      </div>

      <div className="py-1">
        <Perforasi />
      </div>

      <div className="space-y-3 p-4 pt-3">
        <div>
          <p className="text-[15px] font-semibold leading-snug">
            {alamat?.label}
          </p>
          <p className="text-[13px] leading-snug text-ink-2">
            {alamat?.fullAddress}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pickup.categories.map((k) => (
            <ChipSampah key={k} jenis={k} ukuran="sm" />
          ))}
          {pickup.recurring && (
            <span className="inline-flex items-center rounded-kartu border border-line bg-paper px-2 py-0.5 text-[12px] font-medium text-ink-2">
              Jadwal rutin
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Link
            href={`/jadwal/${pickup.id}`}
            className="flex min-h-11 flex-1 items-center justify-center rounded-kartu border border-line-kuat bg-card text-[14px] font-semibold hover:bg-paper"
          >
            Lihat detail
          </Link>
          <Link
            href="/jadwal"
            className="flex min-h-11 flex-1 items-center justify-center rounded-kartu border border-line-kuat bg-card text-[14px] font-semibold hover:bg-paper"
          >
            Ubah jadwal
          </Link>
        </div>
      </div>
    </Kartu>
  );
}
