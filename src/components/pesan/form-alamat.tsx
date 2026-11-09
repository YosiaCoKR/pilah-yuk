"use client";

import { useId, useState } from "react";
import type { Address } from "@/lib/types";
import { Isian } from "../primitif";
import { Tombol } from "../tombol";

type Isi = { label: string; fullAddress: string; landmark: string };
type Galat = Partial<Record<keyof Isi, string>>;

/**
 * Errors say what is wrong and what to do about it, in the app's own voice —
 * no apologies, no vague "invalid input".
 */
function periksa(isi: Isi): Galat {
  const g: Galat = {};
  if (!isi.label.trim()) {
    g.label = "Beri nama alamatnya, mis. Rumah.";
  } else if (isi.label.trim().length > 24) {
    g.label = "Terlalu panjang — maksimal 24 huruf.";
  }

  const alamat = isi.fullAddress.trim();
  if (!alamat) {
    g.fullAddress = "Tulis alamat lengkapnya supaya petugas tidak tersesat.";
  } else if (alamat.length < 10) {
    g.fullAddress = "Masih terlalu singkat. Tambahkan nama jalan dan nomor.";
  } else if (!/\d/.test(alamat)) {
    g.fullAddress = "Sertakan nomor rumah atau nomor RT/RW.";
  }

  return g;
}

export function FormAlamat({
  onSimpan,
  onBatal,
}: {
  onSimpan: (a: Omit<Address, "id">) => void;
  onBatal: () => void;
}) {
  const id = useId();
  const [isi, setIsi] = useState<Isi>({
    label: "",
    fullAddress: "",
    landmark: "",
  });
  const [utama, setUtama] = useState(false);
  /* Validate only after a submit attempt, so warga are not scolded while
     they are still typing the first character. */
  const [dicoba, setDicoba] = useState(false);
  const galat = dicoba ? periksa(isi) : {};

  const ubah = (k: keyof Isi) => (v: string) =>
    setIsi((x) => ({ ...x, [k]: v }));

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const g = periksa(isi);
    if (Object.keys(g).length) {
      document.getElementById(`${id}-${Object.keys(g)[0]}`)?.focus();
      return;
    }
    onSimpan({
      label: isi.label.trim(),
      fullAddress: isi.fullAddress.trim(),
      landmark: isi.landmark.trim(),
      rwChannelName: "RW 05 Sukamaju",
      isDefault: utama,
    });
  }

  return (
    <form className="space-y-4" onSubmit={kirim} noValidate>
      <Isian
        id={`${id}-label`}
        label="Nama alamat"
        bantuan="Supaya mudah dikenali, mis. Rumah atau Warung."
        value={isi.label}
        onChange={ubah("label")}
        placeholder="Rumah"
        galat={galat.label}
      />

      <Isian
        id={`${id}-fullAddress`}
        label="Alamat lengkap"
        bantuan="Tulis nama jalan, nomor rumah, RT dan RW."
        value={isi.fullAddress}
        onChange={ubah("fullAddress")}
        placeholder="Jl. Kenanga No. 12, RT 03 / RW 05"
        baris={3}
        galat={galat.fullAddress}
      />

      <Isian
        id={`${id}-landmark`}
        label="Patokan"
        bantuan="Bantu petugas menemukan rumahmu lebih cepat."
        value={isi.landmark}
        onChange={ubah("landmark")}
        placeholder="Sebelah warung Bu Tini, pagar hijau"
        opsional
      />

      <label className="flex min-h-12 items-center gap-3 rounded-kartu border border-line bg-paper px-3">
        <input
          type="checkbox"
          checked={utama}
          onChange={(e) => setUtama(e.target.checked)}
          className="size-5 accent-hijau"
        />
        <span className="text-[14px] font-medium">
          Jadikan alamat utama
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        <Tombol type="button" varian="garis" onClick={onBatal} className="flex-1">
          Batal
        </Tombol>
        <Tombol type="submit" className="flex-[2]">
          Simpan alamat
        </Tombol>
      </div>
    </form>
  );
}
