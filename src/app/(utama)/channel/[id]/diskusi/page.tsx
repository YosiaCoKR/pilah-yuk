import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PapanDiskusi } from "@/components/channel/papan-diskusi";
import { Kop } from "@/components/kop";
import { Kartu } from "@/components/primitif";
import { channelById } from "@/lib/mock";

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
  const channel = channelById(id);
  if (!channel) notFound();

  return (
    <>
      <Kop
        judul="Papan diskusi"
        keterangan={channel.name}
        kembali={`/channel/${id}`}
      />
      <main className="px-4 pb-10 pt-5">
        <PapanDiskusi channelId={id} />
      </main>
    </>
  );
}
