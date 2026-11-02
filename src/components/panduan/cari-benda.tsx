"use client";

import { useState } from "react";
import { cariBenda } from "@/lib/mock";
import { IkonCari, IkonTutup } from "../ikon";
import { ChipSampah, Kartu } from "../primitif";

/**
 * Cari benda, bukan telusuri kategori.
 *
 * Warga membuka panduan ini sambil berdiri di depan tong dengan satu benda di
 * tangan — pertanyaannya selalu "yang ini masuk mana", bukan "apa saja isi
 * tong organik". Jadi kotak carinya di paling atas, dan kartu jenis di
 * bawahnya tinggal jadi jalan kedua buat yang mau membaca-baca.
 */
export function CariBenda() {
  const [cari, setCari] = useState("");
  const kata = cari.trim();
  const hasil = cariBenda(cari);

  return (
    <div className="space-y-3">
      <div className="relative">
        <IkonCari className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="kulit telur, styrofoam, kardus…"
          aria-label="Cari benda"
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

      {/* Jumlahnya sudah terbaca dari daftarnya sendiri, jadi cukup disuarakan
          untuk yang memakai pembaca layar. */}
      <p className="sr-only" aria-live="polite">
        {kata
          ? `${hasil.length} benda cocok dengan ${kata}`
          : "Belum ada pencarian"}
      </p>

      {kata && hasil.length > 0 && (
        <ul className="space-y-2">
          {hasil.map((benda) => (
            <li key={benda.nama}>
              {/* Jawabannya sendiri sudah terbaca di kartu ini. Tautannya
                  untuk pertanyaan berikutnya — "lalu diapakan" — yang sudah
                  tertulis lengkap di kartu jenis di bawah, jadi tidak perlu
                  diulang di tiap hasil. */}
              <a
                href={`#jenis-${benda.jenis}`}
                className="block rounded-kartu border border-line bg-card p-3 hover:border-line-kuat"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold">{benda.nama}</p>
                  <ChipSampah jenis={benda.jenis} ukuran="sm" />
                </div>
                {benda.catatan && (
                  <p className="mt-1 text-[13px] leading-snug text-ink-2">
                    {benda.catatan}
                  </p>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}

      {kata && hasil.length === 0 && (
        <Kartu className="p-4">
          <p className="text-[15px] font-semibold">
            “{kata}” belum ada di daftar
          </p>
          {/* Layar kosong itu kesempatan memberi arah: warga tetap harus
              memutuskan sesuatu sebelum truk datang. */}
          <p className="mt-1 text-[13px] leading-snug text-ink-2">
            Masukkan ke campuran dan sebutkan bendanya di catatan saat memesan
            jemput. Petugas RW yang memilahnya di TPS.
          </p>
          <a
            href="#jenis-campuran"
            className="mt-3 inline-flex min-h-11 items-center rounded-kartu border border-line-kuat bg-card px-4 text-[14px] font-semibold hover:bg-paper"
          >
            Lihat jenis campuran
          </a>
        </Kartu>
      )}
    </div>
  );
}
