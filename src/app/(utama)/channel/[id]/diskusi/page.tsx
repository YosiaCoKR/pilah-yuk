import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PapanDiskusi } from "@/components/channel/papan-diskusi";
import { Kop } from "@/components/kop";
import { Kartu } from "@/components/primitif";
import { diskusi, satuChannel } from "@/lib/data";

/** Papan diskusi warga satu channel: tanya jawab & koordinasi antar warga. */
export default function DiskusiChannelPage(
  props: PageProps<"/channel/[id]/diskusi">,
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
      <Kop judul="Papan diskusi" kembali="/channel" />
      <div className="space-y-3 px-4 pb-10 pt-5">
        <Kartu className="h-32 animate-pulse" />
        <Kartu className="h-40 animate-pulse" />
      </div>
    </>
  );
}

async function Isi({
  params,
}: {
  params: PageProps<"/channel/[id]/diskusi">["params"];
}) {
  const { id } = await params;
  const channel = await satuChannel(id);
  if (!channel) notFound();
  const utas = await diskusi(id);

  return (
    <>
      <Kop
        judul="Papan diskusi"
        keterangan={channel.name}
        kembali={`/channel/${id}`}
      />
      <main className="px-4 pb-10 pt-5">
        {channel.isMember ? (
          <PapanDiskusi channelId={id} utas={utas} />
        ) : (
          <Kartu className="p-6 text-center">
            <p className="text-[15px] font-semibold">Khusus anggota channel</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Gabung {channel.name} dulu untuk ikut diskusi warga.
            </p>
          </Kartu>
        )}
      </main>
    </>
  );
}
