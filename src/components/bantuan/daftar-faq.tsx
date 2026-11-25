"use client";

import { useState } from "react";
import { cariFaq } from "@/lib/mock";
import { IkonCari, IkonLanjut, IkonTutup } from "../ikon";
import { Kartu, Label } from "../primitif";

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

      {kata && hasil.length === 0 && (
        <Kartu className="p-6 text-center">
          <p className="text-[15px] font-semibold">
            Belum ada jawaban untuk “{kata}”
          </p>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">
            Coba kata lain yang lebih pendek, atau tanyakan langsung di channel
            di bawah.
          </p>
        </Kartu>
      )}

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
    </div>
  );
}
