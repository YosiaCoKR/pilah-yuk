"use client";

import { useState } from "react";
import { CHANNELS, cariFaq } from "@/lib/mock";
import { IkonCari, IkonLanjut, IkonTutup } from "../ikon";
import { Kartu, Label } from "../primitif";
import { TombolLink } from "../tombol";

/**
 * Ke mana bertanya kalau FAQ tidak menjawab: papan diskusi channel warga
 * sendiri — di sana pengurusnya membaca. Belum punya channel → gabung dulu,
 * karena tanpa channel memang tidak ada pengurus yang bisa ditanya.
 */
function KartuKontak({ kata }: { kata?: string }) {
  const channel = CHANNELS.find((c) => c.isMember);
  return (
    <Kartu className="p-4">
      <p className="text-[15px] font-semibold">
        {kata ? `Belum ada jawaban untuk “${kata}”` : "Belum terjawab?"}
      </p>
      <p className="mt-1 text-[14px] leading-snug text-ink-2">
        {channel
          ? `Tanyakan ke ${channel.pengurus}, pengurus ${channel.name}, di papan diskusi. Biasanya dibalas di hari yang sama.`
          : "Gabung channel RT/RW-mu dulu — pengurusnya yang menjawab pertanyaan soal jemput dan pembayaran."}
      </p>
      {kata && (
        <p className="mt-1 text-[13px] leading-snug text-ink-3">
          Atau coba kata yang lebih pendek, mis. “bayar” atau “jadwal”.
        </p>
      )}
      <div className="mt-4">
        <TombolLink
          href={channel ? `/channel/${channel.id}/diskusi` : "/channel"}
          varian={kata ? "utama" : "garis"}
          lebar
        >
          {channel ? "Tanya di papan diskusi" : "Cari channel terdekat"}
        </TombolLink>
      </div>
    </Kartu>
  );
}

export function DaftarFaq() {
  const [cari, setCari] = useState("");
  const kata = cari.trim();
  const hasil = cariFaq(kata);
  const topik = [...new Set(hasil.map((f) => f.topik))];

  return (
    <div className="space-y-7">
      <div className="relative">
        <IkonCari className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="bayar, jadwal, sandi…"
          aria-label="Cari pertanyaan"
          className="min-h-12 w-full rounded-kartu border border-line bg-card pl-11 pr-10 text-[15px] placeholder:text-ink-3"
        />
        {cari && (
          <button
            type="button"
            onClick={() => setCari("")}
            aria-label="Hapus pencarian"
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-kartu text-ink-2 hover:bg-paper"
          >
            <IkonTutup className="size-4" />
          </button>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {kata ? `${hasil.length} jawaban cocok dengan ${kata}` : ""}
      </p>

      {/* Kosong → jalan keluarnya naik ke atas, bukan disuruh menggulir
          mencari kartu kontak di dasar halaman. */}
      {kata && hasil.length === 0 && <KartuKontak kata={kata} />}

      {topik.map((t) => (
        <section key={t} className="space-y-3">
          <Label>{t}</Label>
          {/* <details> bawaan: buka-tutup tanpa pustaka, dibaca benar oleh
              pembaca layar. Saat mencari, jawabannya langsung terbuka —
              warga sedang mencari jawaban, bukan judul. `key` ikut kata
              supaya `open` diterapkan ulang tiap pencarian berubah. */}
          <Kartu className="divide-y divide-line">
            {hasil
              .filter((f) => f.topik === t)
              .map((f) => (
                <details
                  key={`${f.tanya}-${kata}`}
                  open={!!kata}
                  className="group"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{f.tanya}</span>
                    <IkonLanjut className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-4 pb-4 text-[14px] leading-relaxed text-ink-2">
                    {f.jawab}
                  </p>
                </details>
              ))}
          </Kartu>
        </section>
      ))}

      {hasil.length > 0 && <KartuKontak />}
    </div>
  );
}
