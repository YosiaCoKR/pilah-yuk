"use client";

import { useState } from "react";
import { aturPengingat } from "@/lib/toko-jadwal";
import { Sakelar } from "../sakelar";

/**
 * Pengingat yang bisa dinyalakan langsung dari kartu jadwal, tanpa masuk ke
 * form. Mengubah pengingat tidak mengubah jadwalnya, jadi tidak pantas
 * menyeret warga melewati seluruh form hanya untuk ini.
 *
 * Waktunya tetap: sehari sebelum petugas datang (server/src/pengingat.ts).
 */
export function TogglePengingat({
  jadwalId,
  awal,
  nomor,
}: {
  jadwalId: string;
  awal: boolean;
  nomor: string;
}) {
  const [nyala, setNyala] = useState(awal);
  const [galat, setGalat] = useState<string | null>(null);

  async function ubah(baru: boolean) {
    /* Langsung berubah di layar; dikembalikan kalau server menolak. */
    setNyala(baru);
    setGalat(null);
    const h = await aturPengingat(jadwalId, baru);
    if (!h.ok) {
      setNyala(!baru);
      setGalat(h.pesan);
    }
  }

  return (
    <div className="space-y-2">
      <Sakelar
        nyala={nyala}
        onUbah={ubah}
        judul="Pengingat jemput"
        keterangan={`Dikirim sehari sebelumnya ke ${nomor}.`}
        matikanKeterangan="Tidak ada pengingat — kamu perlu ingat sendiri."
      />
      {galat && (
        <p role="alert" className="text-[13px] text-alarm">
          {galat}
        </p>
      )}
    </div>
  );
}
