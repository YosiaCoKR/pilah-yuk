import Link from "next/link";
import { KartuChannel } from "@/components/channel/kartu-channel";
import { KartuJemput } from "@/components/kartu-jemput";
import {
  IkonJadwal,
  IkonLangganan,
  IkonLonceng,
  IkonPanduan,
  IkonRiwayat,
} from "@/components/ikon";
import { PengingatLangganan } from "@/components/pengingat-langganan";
import { Kartu, Label } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { CHANNELS, PICKUPS, SUBSCRIPTION } from "@/lib/mock";

const PINTASAN = [
  { href: "/jadwal", label: "Jadwal rutin", Ikon: IkonJadwal },
  { href: "/riwayat", label: "Riwayat", Ikon: IkonRiwayat },
  { href: "/langganan", label: "Langganan", Ikon: IkonLangganan },
  { href: "/panduan", label: "Panduan pilah", Ikon: IkonPanduan },
];

export default function Beranda() {
  const berikutnya = PICKUPS.find((p) => p.status !== "selesai");
  const channelku = CHANNELS.find((c) => c.isMember);

  return (
    <main className="space-y-7">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-ink-2">Selamat pagi,</p>
          <p className="text-[19px] font-bold leading-tight">Bu Rina</p>
        </div>
        <Link
          href="/notifikasi"
          aria-label="Notifikasi"
          className="relative grid size-11 place-items-center rounded-kartu border border-line bg-card text-ink-2"
        >
          <IkonLonceng className="size-5" />
          <span
            aria-hidden
            className="absolute right-2.5 top-2.5 size-2 rounded-full bg-alarm"
          />
        </Link>
      </header>

      {berikutnya ? (
        <KartuJemput pickup={berikutnya} />
      ) : (
        <Kartu className="p-5 text-center">
          <p className="text-[15px] font-semibold">Belum ada jemput terjadwal</p>
          <p className="mt-1 text-[13px] text-ink-2">
            Pesan sekarang, petugas RW akan datang sesuai jam pilihanmu.
          </p>
        </Kartu>
      )}

      <PengingatLangganan langganan={SUBSCRIPTION} />

      <TombolLink href="/pesan" lebar className="min-h-14 text-[16px]">
        Pesan jemput sampah
      </TombolLink>

      <section className="space-y-3">
        <Label>Pintasan</Label>
        <ul className="grid grid-cols-2 gap-2">
          {PINTASAN.map(({ href, label, Ikon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-[72px] flex-col justify-between rounded-kartu border border-line bg-card p-3 hover:border-line-kuat"
              >
                <Ikon className="size-5 text-hijau" />
                <span className="text-[14px] font-semibold leading-tight">
                  {label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <Label
          aksi={
            <Link href="/channel" className="text-[13px] font-semibold text-hijau">
              {channelku ? "Buka" : "Cari channel"}
            </Link>
          }
        >
          Channel RT/RW
        </Label>
        {channelku ? (
          <ul>
            <KartuChannel channel={channelku} />
          </ul>
        ) : (
          <Kartu className="p-4">
            <p className="text-[15px] font-semibold">Belum gabung channel</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Pesanan jemput diteruskan ke petugas channel sesuai alamatmu —
              gabung dulu supaya ada yang menerima.
            </p>
          </Kartu>
        )}
      </section>
    </main>
  );
}
