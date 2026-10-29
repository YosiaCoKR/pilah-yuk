"use client";

import { useState } from "react";
import { Sakelar } from "../sakelar";

const WAKTU = [
  { id: "h-1", label: "Sehari sebelum", jelas: "Malam sebelum petugas datang" },
  { id: "pagi", label: "Pagi harinya", jelas: "Jam 5 pagi di hari jemput" },
] as const;

/**
 * Pengingat yang bisa dinyalakan langsung dari kartu jadwal, tanpa masuk ke
 * form. Mengubah pengingat tidak mengubah jadwalnya, jadi tidak pantas
 * menyeret warga melewati seluruh form hanya untuk ini.
 */
export function TogglePengingat({
  awal,
  nomor,
}: {
  awal: boolean;
  nomor: string;
}) {
  const [nyala, setNyala] = useState(awal);
  const [waktu, setWaktu] = useState<string>("h-1");

  return (
    <div className="space-y-2">
      <Sakelar
        nyala={nyala}
        onUbah={setNyala}
        judul="Pengingat jemput"
        keterangan={`Dikirim lewat WhatsApp ke ${nomor}.`}
        matikanKeterangan="Tidak ada pengingat — kamu perlu ingat sendiri."
      />

      {/* Pilihan waktu hanya berarti kalau pengingatnya menyala. */}
      {nyala && (
        <fieldset className="rounded-kartu border border-line bg-card p-3">
          <legend className="px-1 text-[13px] text-ink-2">
            Kapan diingatkan
          </legend>
          <div className="mt-1 flex gap-2">
            {WAKTU.map((w) => {
              const aktif = w.id === waktu;
              return (
                <label
                  key={w.id}
                  className={`flex min-h-12 flex-1 cursor-pointer flex-col justify-center rounded-kartu border px-3 ${
                    aktif
                      ? "border-hijau bg-hijau-tipis"
                      : "border-line bg-paper hover:border-line-kuat"
                  }`}
                >
                  <input
                    type="radio"
                    name="waktu-pengingat"
                    value={w.id}
                    checked={aktif}
                    onChange={() => setWaktu(w.id)}
                    className="sr-only"
                  />
                  <span className="text-[14px] font-semibold">{w.label}</span>
                  <span className="text-[12px] leading-snug text-ink-2">
                    {w.jelas}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
