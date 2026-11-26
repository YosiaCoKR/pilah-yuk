import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Kop } from "@/components/kop";
import { FormUmpanBalik } from "@/components/umpan-balik/form-umpan-balik";
import { satuPesanan, ulasanUntuk } from "@/lib/data";
import { tanggalPendek } from "@/lib/tanggal";

export const metadata = { title: "Nilai pelayanan — Pilah Yuk" };

export default function UmpanBalikPage(props: PageProps<"/umpan-balik/[id]">) {
  return (
    <Suspense>
      <Isi params={props.params} />
    </Suspense>
  );
}

async function Isi({
  params,
}: {
  params: PageProps<"/umpan-balik/[id]">["params"];
}) {
  const { id } = await params;
  const [pickup, sudahAda] = await Promise.all([
    satuPesanan(id),
    ulasanUntuk(id),
  ]);
  /* Hanya jemput yang benar-benar selesai yang bisa dinilai. */
  if (!pickup || pickup.status !== "selesai") notFound();

  const petugas = pickup.officerName ?? "petugas";
  return (
    <>
      <Kop
        judul="Nilai pelayanan"
        keterangan={`${petugas} · ${tanggalPendek(pickup.pickupDate)}`}
        kembali={`/riwayat/${id}`}
      />
      <FormUmpanBalik pickupId={id} petugas={petugas} sudahAda={sudahAda} />
    </>
  );
}
