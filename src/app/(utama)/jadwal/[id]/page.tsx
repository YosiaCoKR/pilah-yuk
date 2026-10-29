import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JarakHari } from "@/components/jarak-hari";
import { IkonJam, IkonLonceng, IkonPeta } from "@/components/ikon";
import { RingkasanRutin } from "@/components/jadwal/ringkasan-rutin";
import { Kop } from "@/components/kop";
import { StatusLangsung } from "@/components/riwayat/status-langsung";
import { ChipSampah, Kartu, Label, Perforasi } from "@/components/primitif";
import {
  addressById,
  categoryByKey,
  slotById,
  PICKUPS,
  RECURRING,
} from "@/lib/mock";
import { hariPanjang, tanggalPanjang, tanggalPendek } from "@/lib/tanggal";
import { StatusJemput } from "@/components/status-jemput";

export default function DetailJadwalPage(props: PageProps<"/jadwal/[id]">) {
  return (
    <>
      <Kop judul="Detail jemput" kembali="/jadwal" />
      {/* Isi halaman bergantung pada `params`, jadi ia menyusul setelah
          rangka tercetak. Kerangka menahan tinggi struk supaya tidak
          melompat saat datanya masuk. */}
      <Suspense fallback={<Kerangka />}>
        <Isi params={props.params} />
      </Suspense>
    </>
  );
}

function Kerangka() {
  return (
    <div className="space-y-7 px-4 pb-10 pt-5">
      <Kartu className="h-64 animate-pulse" />
      <Kartu className="h-40 animate-pulse" />
    </div>
  );
}

async function Isi({
  params,
}: {
  params: PageProps<"/jadwal/[id]">["params"];
}) {
  const { id } = await params;
  const pickup = PICKUPS.find((p) => p.id === id);
  if (!pickup) notFound();

  const alamat = addressById(pickup.addressId);
  const slot = slotById(pickup.timeSlotId);
  const rutin = pickup.recurring ? RECURRING : null;

  return (
    <main className="space-y-7 px-4 pb-10 pt-5">
      {/* Struk penuh dipakai di sini: ini satu penjemputan, objek yang sama
            seperti yang warga terima saat memesan. */}
      <Kartu className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div>
            <p className="text-[13px] font-semibold text-ink-2">
              Petugas datang
            </p>
            <p className="angka mt-1 text-[30px] font-extrabold leading-[1.05]">
              {hariPanjang(pickup.pickupDate)}
            </p>
            <p className="angka whitespace-nowrap text-[16px] font-bold leading-tight text-ink-2">
              {tanggalPendek(pickup.pickupDate)} · {slot?.range}
            </p>
            <JarakHari iso={pickup.pickupDate} />
          </div>
          <div className="shrink-0 text-right">
            <StatusJemput status={pickup.status} ringkas />
            <p className="angka mt-1 text-[12px] font-bold text-ink-3">
              {pickup.code}
            </p>
          </div>
        </div>

        <div className="py-1">
          <Perforasi />
        </div>

        <dl className="space-y-3 p-4 pt-3 text-[14px]">
          <Baris ikon={<IkonPeta className="size-4" />} istilah="Alamat">
            <span className="font-semibold">{alamat?.label}</span>
            <br />
            <span className="text-ink-2">{alamat?.fullAddress}</span>
            {alamat?.landmark && (
              <>
                <br />
                <span className="text-ink-3">Patokan: {alamat.landmark}</span>
              </>
            )}
          </Baris>

          <Baris ikon={<IkonJam className="size-4" />} istilah="Jam">
            <span className="angka font-semibold">{slot?.range}</span>
            <br />
            <span className="text-ink-2">{slot?.note}</span>
          </Baris>

          <div>
            <dt className="text-[13px] text-ink-2">Jenis sampah</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {pickup.categories.map((k) => (
                <ChipSampah key={k} jenis={k} ukuran="sm" />
              ))}
            </dd>
          </div>

          {pickup.notes && (
            <div>
              <dt className="text-[13px] text-ink-2">Catatan</dt>
              <dd className="mt-1 leading-snug">“{pickup.notes}”</dd>
            </div>
          )}
        </dl>
      </Kartu>

      <section className="space-y-3">
        <Label>Perjalanan pesanan</Label>
        <StatusLangsung pickupId={pickup.id} statusAwal={pickup.status} />
      </section>

      {/* Tips pilah muncul lagi di sini: ini saat warga menyiapkan karung,
            bukan saat memesan. */}
      <section className="space-y-3">
        <Label>Siapkan sebelum petugas datang</Label>
        <Kartu className="divide-y divide-line">
          {pickup.categories.map((k) => {
            const kategori = categoryByKey(k);
            return (
              <p
                key={k}
                className="flex gap-2.5 p-3 text-[13px] leading-snug text-ink-2"
              >
                <span
                  aria-hidden
                  className="mt-1 size-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--color-${k})` }}
                />
                <span>
                  <span className="font-semibold text-ink">
                    {kategori.name}:
                  </span>{" "}
                  {kategori.handlingTip}
                </span>
              </p>
            );
          })}
        </Kartu>
      </section>

      {rutin && (
        <section className="space-y-3">
          <Label
            aksi={
              <Link
                href="/jadwal"
                className="text-[13px] font-semibold text-hijau"
              >
                Kelola
              </Link>
            }
          >
            Bagian dari jadwal rutin
          </Label>
          <Kartu className="p-4">
            <RingkasanRutin jadwal={rutin} ukuran="sm" />
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-2">
              <IkonLonceng className="size-4 shrink-0" />
              {rutin.reminderEnabled
                ? "Pengingat dikirim sehari sebelumnya."
                : "Pengingat dimatikan."}
            </p>
          </Kartu>
        </section>
      )}

      {pickup.status === "menunggu" && (
        <div className="space-y-2">
          <Link
            href="/jadwal/atur"
            className="flex min-h-12 items-center justify-center rounded-kartu border border-line-kuat bg-card text-[15px] font-semibold hover:bg-paper"
          >
            Geser jadwal ini
          </Link>
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center rounded-kartu border border-alarm/50 bg-card text-[15px] font-semibold text-alarm hover:bg-alarm-tipis"
          >
            Batalkan jemput
          </button>
          <p className="pt-1 text-center text-[13px] leading-snug text-ink-3">
            Selama statusnya masih menunggu, pesanan bisa digeser atau
            dibatalkan tanpa biaya.
          </p>
        </div>
      )}

      {pickup.status === "selesai" && (
        <Kartu className="p-4">
          <p className="text-[13px] text-ink-2">Hasil pengangkutan</p>
          <p className="angka mt-1 text-[24px] font-extrabold">
            {pickup.totalWeightKg} kg
          </p>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Diangkut {pickup.officerName} · {tanggalPanjang(pickup.pickupDate)}
          </p>
        </Kartu>
      )}
    </main>
  );
}

function Baris({
  ikon,
  istilah,
  children,
}: {
  ikon: React.ReactNode;
  istilah: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-ink-3">{ikon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-[13px] text-ink-2">{istilah}</dt>
        <dd className="mt-0.5 leading-snug">{children}</dd>
      </div>
    </div>
  );
}
