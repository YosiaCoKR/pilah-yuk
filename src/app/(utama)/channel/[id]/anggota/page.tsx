import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DaftarAnggota } from "@/components/channel/daftar-anggota";
import { Kop } from "@/components/kop";
import { Kartu } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { channelById } from "@/lib/mock";

/** Kelola anggota channel — khusus pengurus channel yang bersangkutan. */
export default function AnggotaChannelPage(
  props: PageProps<"/channel/[id]/anggota">,
) {
  return (
    <Suspense fallback={<Kerangka />}>
      <Isi params={props.params} />
    </Suspense>
  );
}

/* Kop ikut di dalam Suspense karena tautan kembalinya butuh id channel —
   selama kerangka menunggu, kembali diarahkan ke daftar channel. */
function Kerangka() {
  return (
    <>
      <Kop judul="Kelola anggota" kembali="/channel" />
      <div className="space-y-3 px-4 pb-10 pt-5">
        <Kartu className="h-32 animate-pulse" />
        <Kartu className="h-48 animate-pulse" />
      </div>
    </>
  );
}

async function Isi({
  params,
}: {
  params: PageProps<"/channel/[id]/anggota">["params"];
}) {
  const { id } = await params;
  const channel = channelById(id);
  if (!channel) notFound();

  return (
    <>
      <Kop
        judul="Kelola anggota"
        keterangan={channel.name}
        kembali={`/channel/${id}`}
      />
      <main className="px-4 pb-10 pt-5">
        {/* Pagar peran dipasang di layar juga, bukan hanya di menu: tautannya
            bisa dibagikan ke siapa saja. Pagar sebenarnya menyusul di API. */}
        {channel.isManager ? (
          <DaftarAnggota channelId={id} />
        ) : (
          <Kartu className="p-6 text-center">
            <p className="text-[15px] font-semibold">Khusus pengurus channel</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Daftar anggota {channel.name} hanya bisa dikelola oleh
              pengurusnya, {channel.pengurus}.
            </p>
            <div className="mt-4">
              <TombolLink varian="garis" href={`/channel/${id}`}>
                Kembali ke channel
              </TombolLink>
            </div>
          </Kartu>
        )}
      </main>
    </>
  );
}
