"use client";

import { useState } from "react";
import { IkonCentang, IkonUnduh } from "./ikon";
import { Tombol } from "./tombol";

/**
 * Unduh dan bagikan satu berkas teks.
 *
 * Berkasnya dirakit di perangkat warga dari data yang sudah ada di layar —
 * tidak ada permintaan ke server, jadi tetap jalan di koneksi lambat dan
 * tidak ada yang perlu ditunggu.
 *
 * Berbagi memakai Web Share API bila tersedia (di Android inilah yang
 * membuka WhatsApp); kalau tidak, teksnya disalin ke papan klip. Keduanya
 * berakhir sama bagi warga: berkas siap dikirim ke pengurus RT.
 */
export function AksiBerkas({
  judul,
  namaBerkas,
  teks,
}: {
  /** Judul lembar berbagi, mis. "Bukti pengangkutan PY-4701". */
  judul: string;
  namaBerkas: string;
  teks: string;
}) {
  const [pesan, setPesan] = useState<string | null>(null);

  function unduh() {
    const url = URL.createObjectURL(
      new Blob([teks], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = namaBerkas;
    a.click();
    URL.revokeObjectURL(url);
    setPesan("Tersimpan di perangkatmu.");
  }

  async function bagikan() {
    try {
      if (navigator.share) {
        await navigator.share({ title: judul, text: teks });
        return;
      }
      await navigator.clipboard.writeText(teks);
      setPesan("Sudah disalin. Tinggal tempel di WhatsApp atau catatan.");
    } catch (e) {
      /* Warga menutup lembar berbagi — itu bukan kegagalan, jadi diam saja. */
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPesan("Belum bisa dibagikan dari peramban ini. Coba unduh saja.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Tombol varian="garis" className="flex-1" onClick={unduh}>
          <IkonUnduh className="size-4" />
          Unduh
        </Tombol>
        <Tombol className="flex-1" onClick={bagikan}>
          Bagikan
        </Tombol>
      </div>

      {pesan && (
        <p
          aria-live="polite"
          className="flex items-start gap-1.5 text-[13px] leading-snug text-hijau"
        >
          <IkonCentang className="mt-0.5 size-4 shrink-0" />
          {pesan}
        </p>
      )}
    </div>
  );
}
