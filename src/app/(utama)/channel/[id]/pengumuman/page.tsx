import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IkonChannel } from "@/components/ikon";
import { Kop } from "@/components/kop";
import { Kartu } from "@/components/primitif";
import { umurHari } from "@/lib/kalimat";
import { channelById, pengumumanByChannel } from "@/lib/mock";

/**
 * Semua pengumuman pengurus satu channel, terbaru di atas.
 *
 * Halaman detail channel hanya memuat yang paling baru. Di sini warga menggulir
 * balik: pengumuman lama (jam angkut bergeser, iuran, kerja bakti) masih
 * dipakai sebagai rujukan jauh setelah ditulis.
 */
export default function PengumumanChannelPage(
  props: PageProps<"/channel/[id]/pengumuman">,
) {
  return (
    <Suspense fallback={<Kerangka />}>
      <Isi params={props.params} />
    </Suspense>
  );
}

/* Kop ikut di dalam Suspense karena tautan kembalinya butuh id channel —
   sementara kerangka menunggu, kembali diarahkan ke daftar channel. */
function Kerangka() {
  return (
    <>
      <Kop judul="Pengumuman pengurus" kembali="/channel" />
      <div className="space-y-3 px-4 pb-10 pt-5">
        <Kartu className="h-28 animate-pulse" />
        <Kartu className="h-28 animate-pulse" />
      </div>
    </>
  );
}

async function Isi({
  params,
}: {
  params: PageProps<"/channel/[id]/pengumuman">["params"];
}) {
  const { id } = await params;
  const channel = channelById(id);
  if (!channel) notFound();

  const pengumuman = pengumumanByChannel(id);

  return (
    <>
      <Kop
        judul="Pengumuman pengurus"
        keterangan={channel.name}
        kembali={`/channel/${id}`}
      />

      <main className="space-y-3 px-4 pb-10 pt-5">
        {pengumuman.length === 0 ? (
          <Kartu className="p-6 text-center">
            <p className="text-[15px] font-semibold">Belum ada pengumuman</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Kalau pengurus {channel.name} mengumumkan perubahan jadwal angkut,
              isinya muncul di sini.
            </p>
          </Kartu>
        ) : (
          <ul className="space-y-3">
            {pengumuman.map((p) => (
              <Kartu as="li" key={p.id} className="p-4">
                <article>
                  {/* Umurnya di atas judul: yang pertama ditimbang warga adalah
                      apakah pengumuman ini masih berlaku. */}
                  <p className="text-[12px] text-ink-3">{umurHari(p.agoDays)}</p>
                  <h2 className="mt-0.5 text-[16px] font-bold leading-tight">
                    {p.title}
                  </h2>
                  <p className="mt-1.5 text-[14px] leading-snug">{p.content}</p>
                  <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[12px] text-ink-2">
                    <IkonChannel className="size-3.5 shrink-0 text-ink-3" />
                    <span className="font-semibold text-ink">{p.author}</span>
                    <span className="text-ink-3">·</span>
                    {p.authorRole}
                  </p>
                </article>
              </Kartu>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
