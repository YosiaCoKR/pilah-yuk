"use client";

import type { Address, TimeSlot, WasteKey } from "@/lib/types";
import { tanggalPanjang } from "@/lib/tanggal";
import { ChipSampah, Kartu, Label, Perforasi } from "../primitif";

/**
 * The running summary, drawn as the same ticket warga receive after sending.
 * Seeing the final object while still editing is what makes the separate
 * confirmation step unnecessary.
 */
export function Ringkasan({
  alamat,
  slot,
  tanggal,
  jenis,
  catatan,
  onLompat,
}: {
  alamat?: Address;
  slot?: TimeSlot;
  tanggal: string | null;
  jenis: WasteKey[];
  catatan: string;
  onLompat: (bagian: "alamat" | "jenis" | "waktu") => void;
}) {
  return (
    <section className="space-y-3">
      <Label>Ringkasan pesanan</Label>

      <Kartu className="overflow-hidden">
        <div className="space-y-3 p-4">
          <Baris
            istilah="Alamat"
            kosong={!alamat}
            onUbah={() => onLompat("alamat")}
          >
            {alamat && (
              <>
                <span className="block font-semibold">{alamat.label}</span>
                <span className="block text-[13px] font-normal leading-snug text-ink-2">
                  {alamat.fullAddress}
                </span>
              </>
            )}
          </Baris>

          <Baris
            istilah="Tanggal"
            kosong={!tanggal}
            onUbah={() => onLompat("waktu")}
          >
            {tanggal && tanggalPanjang(tanggal)}
          </Baris>

          <Baris istilah="Jam" kosong={!slot} onUbah={() => onLompat("waktu")}>
            {slot && <span className="angka">{slot.range}</span>}
          </Baris>
        </div>

        <div className="py-1">
          <Perforasi />
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink-2">Jenis sampah</p>
              {jenis.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {jenis.map((k) => (
                    <ChipSampah key={k} jenis={k} ukuran="sm" />
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[14px] text-ink-3">Belum dipilih</p>
              )}
            </div>
            <Ubah onClick={() => onLompat("jenis")} />
          </div>

          {catatan.trim() && (
            <div>
              <p className="text-[13px] text-ink-2">Catatan</p>
              <p className="mt-1 text-[14px] leading-snug">“{catatan.trim()}”</p>
            </div>
          )}
        </div>
      </Kartu>

      <p className="text-[13px] leading-snug text-ink-3">
        Permintaan dikirim ke petugas channel. Kamu bisa membatalkan selama
        statusnya masih menunggu.
      </p>
    </section>
  );
}

function Baris({
  istilah,
  children,
  kosong,
  onUbah,
}: {
  istilah: string;
  children: React.ReactNode;
  kosong: boolean;
  onUbah: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-2">{istilah}</p>
        <div className="mt-0.5 text-[14px] font-medium">
          {kosong ? <span className="text-ink-3">Belum dipilih</span> : children}
        </div>
      </div>
      <Ubah onClick={onUbah} />
    </div>
  );
}

function Ubah({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-kartu px-2 py-1 text-[13px] font-semibold text-hijau hover:bg-hijau-tipis"
    >
      Ubah
    </button>
  );
}
