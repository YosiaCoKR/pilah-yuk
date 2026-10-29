"use client";

import { useState } from "react";
import { addressById, slotById } from "@/lib/mock";
import { tanggalPanjang } from "@/lib/tanggal";
import type { Pickup } from "@/lib/types";
import { IkonCentang, IkonUnduh } from "../ikon";
import { Tombol } from "../tombol";

const kg = (n: number) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/** Tanda terima sebagai teks biasa — bisa dibaca di mana saja, termasuk WA. */
function teksBukti(pickup: Pickup, namaKategori: string[]) {
  const alamat = addressById(pickup.addressId);
  const slot = slotById(pickup.timeSlotId);
  return [
    "TANDA TERIMA PENGANGKUTAN SAMPAH",
    "Pilah Yuk",
    "",
    `Kode       : ${pickup.code}`,
    `Tanggal    : ${tanggalPanjang(pickup.pickupDate)}`,
    `Jam        : ${slot?.range ?? "-"}`,
    `Alamat     : ${alamat?.label} — ${alamat?.fullAddress}`,
    `Channel    : ${alamat?.rwChannelName ?? "-"}`,
    `Petugas    : ${pickup.officerName ?? "-"}`,
    `Jenis      : ${namaKategori.join(", ")}`,
    `Berat total: ${kg(pickup.totalWeightKg ?? 0)} kg`,
    /* null, bukan "" — baris kosong di atas memang disengaja sebagai
       pemisah, jadi hanya baris opsional yang boleh hilang. */
    pickup.notes ? `Catatan    : ${pickup.notes}` : null,
    "",
    "Dokumen ini dibuat otomatis dari aplikasi Pilah Yuk.",
  ]
    .filter((b) => b !== null)
    .join("\n");
}

/**
 * Unduh dan bagikan bukti pengangkutan.
 *
 * Berkasnya dirakit di perangkat warga dari data yang sudah ada di layar —
 * tidak ada permintaan ke server, jadi tetap jalan di koneksi lambat dan
 * tidak ada yang perlu ditunggu.
 *
 * Berbagi memakai Web Share API bila tersedia (di Android inilah yang
 * membuka WhatsApp); kalau tidak, teksnya disalin ke papan klip. Keduanya
 * berakhir sama bagi warga: bukti siap dikirim ke pengurus RT.
 */
export function AksiBukti({ pickup }: { pickup: Pickup }) {
  const [pesan, setPesan] = useState<string | null>(null);
  const namaKategori = pickup.categories.map(
    (k) => k.charAt(0).toUpperCase() + k.slice(1),
  );

  function unduh() {
    const teks = teksBukti(pickup, namaKategori);
    const url = URL.createObjectURL(
      new Blob([teks], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `bukti-${pickup.code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setPesan("Bukti tersimpan di perangkatmu.");
  }

  async function bagikan() {
    const teks = teksBukti(pickup, namaKategori);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Bukti pengangkutan ${pickup.code}`,
          text: teks,
        });
        return;
      }
      await navigator.clipboard.writeText(teks);
      setPesan("Bukti disalin. Tinggal tempel di WhatsApp atau catatan.");
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
