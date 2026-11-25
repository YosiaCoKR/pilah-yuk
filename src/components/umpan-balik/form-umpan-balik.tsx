"use client";

import { useState, useTransition } from "react";
import { hariIniISO } from "@/lib/tanggal";
import { simpanUlasan } from "@/lib/toko-ulasan";
import type { Ulasan } from "@/lib/types";
import { IkonBintang, IkonCentang } from "../ikon";
import { Isian, Kartu, Label } from "../primitif";
import { Tombol, TombolLink } from "../tombol";
import { KATA_NILAI as KATA, RingkasUlasan } from "./ulasan-pickup";

/* Pilihan cepat dipisah menurut nada nilai: warga yang memberi 2 bintang
   butuh kata untuk masalahnya, bukan pujian. */
const PUJIAN = [
  "Datang tepat waktu",
  "Petugas ramah",
  "Rapi, tidak tercecer",
  "Timbangan jelas",
];
const KELUHAN = [
  "Datang terlambat",
  "Ada sampah tertinggal",
  "Sampah tercecer",
  "Petugas kurang sopan",
];

export function FormUmpanBalik({
  pickupId,
  petugas,
}: {
  pickupId: string;
  petugas: string;
}) {
  const [nilai, setNilai] = useState(0);
  const [tanda, setTanda] = useState<string[]>([]);
  const [catatan, setCatatan] = useState("");
  const [terkirim, setTerkirim] = useState<Ulasan | null>(null);
  const [kirim, mulaiKirim] = useTransition();

  const pilihan = nilai >= 4 ? PUJIAN : KELUHAN;

  function ubahNilai(n: number) {
    /* Ganti nada → tanda lama tidak lagi masuk akal, jadi dikosongkan. */
    if (n >= 4 !== nilai >= 4) setTanda([]);
    setNilai(n);
  }

  function simpan() {
    const u: Ulasan = {
      pickupId,
      nilai: nilai as Ulasan["nilai"],
      tanda,
      catatan: catatan.trim(),
      dikirim: hariIniISO(),
    };
    mulaiKirim(() => {
      simpanUlasan(u);
      setTerkirim(u);
    });
  }

  if (terkirim) {
    return (
      <div className="space-y-5 px-4 pb-10 pt-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-hijau text-white">
          <IkonCentang className="size-7" />
        </span>
        <div>
          <p className="text-[19px] font-bold">Terima kasih!</p>
          <p className="mt-1 text-[14px] leading-snug text-ink-2">
            Penilaianmu diteruskan ke pengurus channel supaya pelayanan{" "}
            {petugas} makin baik.
          </p>
        </div>
        {/* Rekap persis yang terkirim — warga tahu apa yang dibaca pengurus. */}
        <Kartu className="p-4 text-left">
          <RingkasUlasan u={terkirim} />
        </Kartu>
        <div className="space-y-2">
          <TombolLink href={`/riwayat/${pickupId}`} varian="garis" lebar>
            Kembali ke detail
          </TombolLink>
          <TombolLink href="/umpan-balik" varian="halus" lebar>
            Lihat semua penilaianku
          </TombolLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 px-4 pb-40 pt-5">
      <section className="space-y-3">
        <Label>Seberapa puas kamu?</Label>
        <Kartu className="p-4">
          <fieldset>
            <legend className="sr-only">Nilai 1 sampai 5 bintang</legend>
            <div className="flex justify-between">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="grid size-12 cursor-pointer place-items-center rounded-kartu text-hijau has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hijau"
                >
                  <input
                    type="radio"
                    name="nilai"
                    value={n}
                    checked={nilai === n}
                    onChange={() => ubahNilai(n)}
                    className="sr-only"
                    aria-label={`${n} bintang — ${KATA[n]}`}
                  />
                  <IkonBintang
                    className={`size-9 ${n <= nilai ? "" : "text-line-kuat"}`}
                    fill={n <= nilai ? "currentColor" : "none"}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <p
            aria-live="polite"
            className="mt-2 text-center text-[14px] font-semibold text-ink-2"
          >
            {nilai ? KATA[nilai] : "Ketuk bintang untuk menilai"}
          </p>
        </Kartu>
      </section>

      {nilai > 0 && (
        <section className="space-y-3">
          <Label>
            {nilai >= 4 ? "Yang paling terasa" : "Apa yang kurang?"}
          </Label>
          <div className="flex flex-wrap gap-2">
            {pilihan.map((t) => {
              const aktif = tanda.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() =>
                    setTanda((s) =>
                      aktif ? s.filter((x) => x !== t) : [...s, t],
                    )
                  }
                  className={`min-h-11 rounded-kartu border px-3 text-[14px] font-medium ${
                    aktif
                      ? "border-hijau bg-hijau-tipis text-ink"
                      : "border-line bg-card text-ink-2 hover:border-line-kuat"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Isian
        id="catatan-umpan-balik"
        label="Cerita sedikit"
        bantuan="Dibaca pengurus channel, bukan dipajang ke warga lain."
        value={catatan}
        onChange={(v) => setCatatan(v.slice(0, 500))}
        placeholder="Mis. petugas sudah bantu angkat karung ke gerobak"
        baris={4}
        opsional
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-screen-sm">
          <Tombol lebar disabled={!nilai || kirim} onClick={simpan}>
            {kirim ? "Mengirim…" : "Kirim penilaian"}
          </Tombol>
        </div>
      </div>
    </div>
  );
}
