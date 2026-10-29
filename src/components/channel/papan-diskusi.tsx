"use client";

import { useState } from "react";
import { umurHari } from "@/lib/kalimat";
import { kirimBalasan, kirimUtas, useDiskusi } from "@/lib/toko-diskusi";
import type { ChannelComment } from "@/lib/types";
import { Kartu, Label } from "../primitif";
import { Tombol } from "../tombol";
import { KomposerDiskusi } from "./komposer-diskusi";

/**
 * Papan diskusi warga satu channel.
 *
 * Satu utas = satu pertanyaan, balasannya menempel di bawahnya dalam urutan
 * percakapan. Jawaban pengurus diberi penanda jabatan karena di papan RT
 * itulah yang membedakan "kata warga" dari "kata yang berlaku".
 */
export function PapanDiskusi({ channelId }: { channelId: string }) {
  const utas = useDiskusi(channelId);
  const [balasKe, setBalasKe] = useState<string | null>(null);

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <Label>Tanya warga</Label>
        <KomposerDiskusi
          ajakan="Tulis pertanyaan atau info untuk warga channel ini…"
          tombol="Kirim pertanyaan"
          onKirim={(isi) => kirimUtas(channelId, isi)}
        />
      </section>

      <section className="space-y-3">
        <Label
          aksi={
            utas.length > 0 ? (
              <span className="angka text-[13px] text-ink-2">
                {utas.length} utas
              </span>
            ) : undefined
          }
        >
          Diskusi
        </Label>

        {utas.length === 0 ? (
          <Kartu className="p-6 text-center">
            <p className="text-[15px] font-semibold">Papan masih kosong</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Belum ada yang bertanya di channel ini. Pertanyaan pertama biasanya
              soal jam angkut.
            </p>
          </Kartu>
        ) : (
          <ul className="space-y-3">
            {utas.map((u) => (
              <Kartu as="li" key={u.id} className="overflow-hidden">
                <article>
                  <div className="p-4">
                    <Tulisan tulisan={u} tebal />
                  </div>

                  {u.replies.length > 0 && (
                    /* Balasan menjorok dan diberi garis — satu percakapan,
                       bukan daftar tulisan yang berdiri sendiri. */
                    <ul className="divide-y divide-line border-t border-line bg-paper">
                      {u.replies.map((b) => (
                        <li key={b.id} className="py-3 pl-7 pr-4">
                          <div className="border-l-2 border-line-kuat pl-3">
                            <Tulisan tulisan={b} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="border-t border-line p-3">
                    {balasKe === u.id ? (
                      <KomposerDiskusi
                        ajakan={`Balas ${u.author}…`}
                        tombol="Kirim balasan"
                        fokusAwal
                        onBatal={() => setBalasKe(null)}
                        onKirim={(isi) => {
                          kirimBalasan(channelId, u.id, isi);
                          setBalasKe(null);
                        }}
                      />
                    ) : (
                      <Tombol
                        varian="halus"
                        onClick={() => setBalasKe(u.id)}
                        className="min-h-11 px-2 text-[14px]"
                      >
                        {u.replies.length === 0
                          ? "Balas"
                          : `Balas · ${u.replies.length} balasan`}
                      </Tombol>
                    )}
                  </div>
                </article>
              </Kartu>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tulisan({
  tulisan,
  tebal = false,
}: {
  tulisan: ChannelComment;
  tebal?: boolean;
}) {
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-ink-3">
        <span className="font-semibold text-ink">{tulisan.author}</span>
        {tulisan.authorRole && (
          <span className="rounded-kartu border border-hijau/45 bg-hijau-tipis px-1.5 py-px font-semibold text-hijau">
            {tulisan.authorRole}
          </span>
        )}
        <span>·</span>
        {umurHari(tulisan.agoDays)}
      </p>
      <p
        className={`mt-1 leading-snug ${tebal ? "text-[15px] font-semibold" : "text-[14px]"}`}
      >
        {tulisan.content}
      </p>
    </>
  );
}
