import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IkonJam, IkonPeta } from "@/components/ikon";
import { Kop } from "@/components/kop";
import { LiniStatus } from "@/components/lini-status";
import { ChipSampah, Kartu, Label, Perforasi } from "@/components/primitif";
import { AksiBukti } from "@/components/riwayat/aksi-bukti";
import { KartuPetugas } from "@/components/riwayat/kartu-petugas";
import { RincianSampah } from "@/components/riwayat/rincian-sampah";
import { StatusJemput } from "@/components/status-jemput";
import { addressById, slotById, SEMUA_PICKUP } from "@/lib/mock";
import { hariPanjang, tanggalPanjang, tanggalPendek } from "@/lib/tanggal";

export default function DetailPengangkutanPage(
  props: PageProps<"/riwayat/[id]">,
) {
  return (
    <>
      <Kop judul="Detail pengangkutan" kembali="/riwayat" />
      <Suspense fallback={<Kerangka />}>
        <Isi params={props.params} />
      </Suspense>
    </>
  );
}

function Kerangka() {
  return (
    <div className="space-y-6 px-4 pb-10 pt-5">
      <Kartu className="h-72 animate-pulse" />
      <Kartu className="h-36 animate-pulse" />
    </div>
  );
}

const kg = (n: number) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

async function Isi({
  params,
}: {
  params: PageProps<"/riwayat/[id]">["params"];
}) {
  const { id } = await params;
  const pickup = SEMUA_PICKUP.find((p) => p.id === id);
  if (!pickup) notFound();

  const alamat = addressById(pickup.addressId);
  const slot = slotById(pickup.timeSlotId);
  const batal = pickup.status === "batal";
  const selesai = pickup.status === "selesai";

  return (
    <main className="space-y-6 px-4 pb-10 pt-5">
      {/* Struk pengangkutan: ini berkas yang dibawa warga ke rapat RT. */}
      <Kartu className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-2">
              {selesai ? "Berat terangkut" : "Pengangkutan"}
            </p>
            {selesai ? (
              <p className="angka mt-0.5 text-[38px] font-extrabold leading-none">
                {kg(pickup.totalWeightKg ?? 0)}
                <span className="ml-1 text-[20px] text-ink-2">kg</span>
              </p>
            ) : (
              <p className="mt-0.5 text-[20px] font-bold leading-tight">
                {batal ? "Tidak jadi diangkut" : "Belum diangkut"}
              </p>
            )}
            <p className="angka mt-1 text-[14px] font-bold text-ink-2">
              {pickup.code}
            </p>
          </div>
          <StatusJemput status={pickup.status} />
        </div>

        <div className="py-1">
          <Perforasi />
        </div>

        <dl className="space-y-3 p-4 pt-3 text-[14px]">
          <Baris ikon={<IkonJam className="size-4" />} istilah="Waktu">
            <span className="font-semibold">
              {hariPanjang(pickup.pickupDate)},{" "}
              {tanggalPendek(pickup.pickupDate)}
            </span>
            <br />
            <span className="angka text-ink-2">{slot?.range}</span>
          </Baris>

          <Baris ikon={<IkonPeta className="size-4" />} istilah="Alamat">
            <span className="font-semibold">{alamat?.label}</span>
            <br />
            <span className="text-ink-2">{alamat?.fullAddress}</span>
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

      {batal ? (
        <Kartu className="p-4">
          <p className="text-[14px] leading-snug text-ink-2">
            Pengangkutan ini dibatalkan, jadi tidak ada berat maupun bukti yang
            tercatat. Kuota jemputmu tidak terpakai.
          </p>
        </Kartu>
      ) : (
        <section className="space-y-3">
          <Label>Perjalanan pesanan</Label>
          <Kartu className="p-4">
            <LiniStatus sekarang={pickup.status} />
          </Kartu>
        </section>
      )}

      {pickup.officerName && (
        <section className="space-y-3">
          <Label>Diangkut oleh</Label>
          <KartuPetugas
            nama={pickup.officerName}
            channel={alamat?.rwChannelName}
            jumlahAngkut={
              SEMUA_PICKUP.filter(
                (p) =>
                  p.officerName === pickup.officerName &&
                  p.addressId === pickup.addressId &&
                  p.status === "selesai",
              ).length
            }
          />
        </section>
      )}

      {selesai && (
        <section className="space-y-3">
          <Label>Rincian jenis sampah</Label>
          <RincianSampah
            jenis={pickup.categories}
            totalKg={pickup.totalWeightKg ?? 0}
          />
          <p className="text-[13px] leading-snug text-ink-3">
            Petugas menimbang semuanya sekaligus di tempat. Angka per jenis
            adalah perkiraan bagian, bukan hasil timbangan terpisah.
          </p>
        </section>
      )}

      {selesai && (
        <section className="space-y-3">
          <Label>Bukti pengangkutan</Label>
          <Kartu className="p-4">
            <p className="text-[14px] leading-snug text-ink-2">
              Tanda terima berisi tanggal, berat, petugas, dan kode{" "}
              <span className="angka font-semibold text-ink">
                {pickup.code}
              </span>
              . Simpan atau bagikan untuk keperluan RT/RW.
            </p>
            <p className="mt-2 text-[13px] text-ink-3">
              Diangkut {tanggalPanjang(pickup.pickupDate)}.
            </p>
            <div className="mt-4">
              <AksiBukti pickup={pickup} />
            </div>
          </Kartu>
        </section>
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
