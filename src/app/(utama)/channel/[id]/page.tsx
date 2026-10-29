import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  IkonChannel,
  IkonJadwal,
  IkonJam,
  IkonLanjut,
  IkonPeta,
} from "@/components/ikon";
import { Kop } from "@/components/kop";
import { Kartu, Label, Perforasi } from "@/components/primitif";
import { umurHari } from "@/lib/kalimat";
import {
  anggotaByChannel,
  channelById,
  diskusiByChannel,
  jarakTerbaca,
  pengumumanByChannel,
} from "@/lib/mock";

export default function DetailChannelPage(props: PageProps<"/channel/[id]">) {
  return (
    <>
      <Kop judul="Channel RT/RW" kembali="/channel" />
      <Suspense fallback={<Kerangka />}>
        <Isi params={props.params} />
      </Suspense>
    </>
  );
}

function Kerangka() {
  return (
    <div className="space-y-6 px-4 pb-10 pt-5">
      <Kartu className="h-56 animate-pulse" />
      <Kartu className="h-32 animate-pulse" />
    </div>
  );
}

/**
 * "Selasa & Jumat, 06.00–08.00" → hari dan jamnya dipisah supaya jam angkut
 * bisa dicetak besar. Warga melirik layar ini untuk satu hal: jam berapa
 * truknya lewat.
 */
function pecahJadwal(info: string) {
  const [hari, ...sisa] = info.split(", ");
  return { hari, jam: sisa.join(", ") || null };
}

async function Isi({
  params,
}: {
  params: PageProps<"/channel/[id]">["params"];
}) {
  const { id } = await params;
  const channel = channelById(id);
  if (!channel) notFound();

  const { hari, jam } = pecahJadwal(channel.scheduleInfo);
  const pengumuman = pengumumanByChannel(id);
  const utas = diskusiByChannel(id);
  const menunggu = anggotaByChannel(id).filter(
    (a) => a.status === "menunggu",
  ).length;

  return (
    <main className="space-y-6 px-4 pb-10 pt-5">
      <Kartu className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold leading-tight">
              {channel.name}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-2">
              RT {channel.rtNumber} · Kel. {channel.kelurahan}
            </p>
          </div>
          {channel.isMember ? (
            <span className="shrink-0 rounded-kartu border border-hijau/45 bg-hijau-tipis px-2 py-0.5 text-[12px] font-semibold text-hijau">
              Channelmu
            </span>
          ) : (
            <span className="angka shrink-0 text-[13px] font-semibold text-ink-2">
              {jarakTerbaca(channel.distanceM)}
            </span>
          )}
        </div>

        <div className="py-1">
          <Perforasi />
        </div>

        {/* Jadwal angkut dicetak sebesar berat di struk riwayat — ini angka
            yang dicari warga saat membuka halaman channel. */}
        <div className="p-4 pt-3">
          <p className="text-[13px] font-semibold text-ink-2">Jadwal angkut</p>
          <p className="mt-0.5 text-[20px] font-bold leading-tight">{hari}</p>
          {jam && (
            <p className="angka mt-1 text-[28px] font-extrabold leading-none">
              {jam}
            </p>
          )}
          <p className="mt-2 text-[13px] leading-snug text-ink-3">
            Siapkan karung di depan pagar sebelum jam mulai. Di luar jadwal ini,
            pesan jemput satuan lewat tombol Pesan.
          </p>
        </div>
      </Kartu>

      <section className="space-y-3">
        <Label>Info channel</Label>
        <Kartu className="p-4">
          <dl className="space-y-3 text-[14px]">
            <Baris ikon={<IkonChannel className="size-4" />} istilah="Pengurus">
              <span className="font-semibold">{channel.pengurus}</span>
              <br />
              <span className="angka text-ink-2">
                {channel.memberCount} warga tergabung
              </span>
            </Baris>

            <Baris ikon={<IkonPeta className="size-4" />} istilah="Wilayah">
              <span className="font-semibold">
                RW {channel.rwNumber} · RT {channel.rtNumber}
              </span>
              <br />
              <span className="text-ink-2">
                Kel. {channel.kelurahan} · kode pos {channel.areaCode}
              </span>
            </Baris>

            <Baris ikon={<IkonJam className="size-4" />} istilah="Jarak">
              <span className="text-ink-2">
                {jarakTerbaca(channel.distanceM)} dari alamat utamamu
              </span>
            </Baris>
          </dl>
        </Kartu>
      </section>

      <section className="space-y-3">
        {/* Hanya yang terbaru dicetak di sini; sisanya dibaca di halaman
            pengumuman supaya layar channel tetap soal jadwal angkut. */}
        <Label
          aksi={
            pengumuman.length > 1 ? (
              <Link
                href={`/channel/${channel.id}/pengumuman`}
                className="text-[13px] font-semibold text-hijau hover:underline"
              >
                Semua {pengumuman.length}
              </Link>
            ) : undefined
          }
        >
          Pengumuman pengurus
        </Label>
        {pengumuman[0] ? (
          <Kartu className="p-4">
            <p className="text-[14px] font-semibold leading-tight">
              {pengumuman[0].title}
            </p>
            <p className="mt-1.5 text-[14px] leading-snug">
              {pengumuman[0].content}
            </p>
            <p className="mt-2 text-[12px] text-ink-3">
              {pengumuman[0].author} · {umurHari(pengumuman[0].agoDays)}
            </p>
          </Kartu>
        ) : (
          <Kartu className="p-4">
            <p className="text-[13px] leading-snug text-ink-2">
              Belum ada pengumuman dari pengurus channel ini.
            </p>
          </Kartu>
        )}
      </section>

      {/* Papan diskusi hidup di halaman sendiri — isinya panjang dan berubah
          terus, sementara layar ini harus tetap bisa dibaca sekilas. */}
      <section className="space-y-3">
        <Label>Papan diskusi warga</Label>
        <Kartu className="overflow-hidden">
          <Link
            href={`/channel/${channel.id}/diskusi`}
            className="flex items-center gap-3 p-4 hover:bg-paper"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">
                {utas.length === 0
                  ? "Belum ada diskusi"
                  : `${utas.length} utas warga`}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">
                {utas[0]
                  ? `Terbaru — ${utas[0].author}: ${utas[0].content}`
                  : "Tanya jawab soal jam angkut dan cara memilah."}
              </span>
            </span>
            <IkonLanjut className="size-4 shrink-0 text-ink-3" />
          </Link>
        </Kartu>
      </section>

      {/* Hanya pengurus channel ini yang melihat pintunya — warga lain tidak
          perlu tahu layar itu ada. */}
      {channel.isManager && (
        <section className="space-y-3">
          <Label>Pengurus channel</Label>
          <Kartu className="overflow-hidden">
            <Link
              href={`/channel/${channel.id}/anggota`}
              className="flex items-center gap-3 p-4 hover:bg-paper"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">
                  Kelola anggota
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">
                  {menunggu === 0
                    ? "Tidak ada permintaan gabung yang menunggu."
                    : `${menunggu} permintaan gabung menunggu persetujuan.`}
                </span>
              </span>
              <IkonLanjut className="size-4 shrink-0 text-ink-3" />
            </Link>
          </Kartu>
        </section>
      )}

      {!channel.isMember && (
        <Kartu className="p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <IkonJadwal className="size-4 text-hijau" />
            Belum jadi anggota
          </p>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">
            Jadwal di atas berlaku untuk warga channel ini. Gabung dulu supaya
            pesanan jemputmu diteruskan ke petugasnya.
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
