import Link from "next/link";
import { jarakTerbaca } from "@/lib/mock";
import type { Channel } from "@/lib/types";
import { IkonChannel, IkonJadwal, IkonPeta } from "../ikon";
import { Kartu } from "../primitif";

/**
 * Satu channel RT/RW dalam daftar.
 *
 * Yang ditimbang warga saat memilih: seberapa dekat, kapan truknya lewat,
 * dan siapa pengurusnya. Tiga hal itu yang ditampilkan — jumlah anggota
 * menyusul sebagai penanda bahwa channel-nya hidup.
 */
export function KartuChannel({ channel }: { channel: Channel }) {
  return (
    <Kartu as="li" className="overflow-hidden">
      <Link href={`/channel/${channel.id}`} className="block p-4 hover:bg-paper">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold leading-tight">
              {channel.name}
            </h3>
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

        <dl className="mt-3 space-y-1.5 text-[13px]">
          <div className="flex items-start gap-2">
            <dt className="shrink-0 text-ink-3">
              <IkonJadwal className="size-4" />
              <span className="sr-only">Jadwal angkut</span>
            </dt>
            <dd className="angka font-semibold">{channel.scheduleInfo}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="shrink-0 text-ink-3">
              <IkonChannel className="size-4" />
              <span className="sr-only">Pengurus dan anggota</span>
            </dt>
            <dd className="text-ink-2">
              {channel.pengurus} · {channel.memberCount} warga
            </dd>
          </div>
          {!channel.isMember && (
            <div className="flex items-start gap-2">
              <dt className="shrink-0 text-ink-3">
                <IkonPeta className="size-4" />
                <span className="sr-only">Jarak</span>
              </dt>
              <dd className="text-ink-2">
                {jarakTerbaca(channel.distanceM)} dari alamat utamamu
              </dd>
            </div>
          )}
        </dl>

        {channel.latestPost && (
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-snug text-ink-2">
            <span className="font-semibold text-ink">
              {channel.latestPost.author}:
            </span>{" "}
            {channel.latestPost.content}
          </p>
        )}
      </Link>
    </Kartu>
  );
}
