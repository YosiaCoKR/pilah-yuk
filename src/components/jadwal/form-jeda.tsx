"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useNilaiKlien } from "@/lib/klien";
import { kalimatRutin } from "@/lib/kalimat";
import { PICKUPS } from "@/lib/mock";
import {
  geserHari,
  hariIniISO,
  hariPendek,
  tanggalPanjang,
  tanggalPendek,
} from "@/lib/tanggal";
import { jalankanJadwal, jedaJadwal, useJadwal } from "@/lib/toko-jadwal";
import { Kop } from "../kop";
import { Kartu, Label } from "../primitif";
import { Tombol } from "../tombol";

type Pilihan = "1-minggu" | "2-minggu" | "1-bulan" | "tanpa-batas";

const PRESET: { id: Pilihan; label: string; hari: number | null }[] = [
  { id: "1-minggu", label: "1 minggu", hari: 7 },
  { id: "2-minggu", label: "2 minggu", hari: 14 },
  { id: "1-bulan", label: "1 bulan", hari: 30 },
  { id: "tanpa-batas", label: "Sampai saya nyalakan", hari: null },
];

/** Tanggal selesai jeda untuk sebuah preset — null berarti tanpa batas. */
const akhirJeda = (mulai: string, hari: number | null) =>
  hari === null ? null : geserHari(mulai, hari);

export function FormJeda() {
  const jadwal = useJadwal();
  const router = useRouter();
  const [pilihan, setPilihan] = useState<Pilihan>("1-minggu");
  /* useTransition, bukan useState: App Router menyimpan segmen di cache
     klien, jadi kembali ke halaman ini bisa memakai komponen yang sama tanpa
     remount — flag buatan sendiri akan tertinggal menyala. Pending milik
     transition pulih sendiri. */
  const [kirim, mulaiKirim] = useTransition();

  const dijeda = jadwal.isPaused;

  /* Hanya "hari ini" yang diambil lewat hook — sebuah string, jadi
     referensinya stabil. Sisanya diturunkan dengan useMemo. Mengembalikan
     array baru dari useSyncExternalStore akan membuat React mengulang
     render tanpa henti. */
  const preset = PRESET.find((p) => p.id === pilihan)!;
  const hariIni = useNilaiKlien(hariIniISO, null);
  const sampai = hariIni ? akhirJeda(hariIni, preset.hari) : null;

  /* Jemput yang sudah terjadwal di rentang jeda akan ikut dibatalkan —
     warga harus tahu persis berapa, bukan diberi tahu setelahnya. */
  const terdampak = useMemo(
    () =>
      hariIni
        ? PICKUPS.filter(
            (p) =>
              p.status === "menunggu" &&
              p.recurring &&
              p.pickupDate >= hariIni &&
              (sampai === null || p.pickupDate <= sampai),
          )
        : [],
    [hariIni, sampai],
  );

  function simpan() {
    mulaiKirim(() => {
      /* Perubahan dipakai sekarang juga, jadi kartu di halaman jadwal sudah
         berubah begitu warga sampai di sana. */
      if (dijeda) jalankanJadwal();
      else jedaJadwal(sampai);
      router.push("/jadwal");
    });
  }

  if (dijeda) {
    return (
      <>
        <Kop
          judul="Jalankan jadwal lagi"
          keterangan="Petugas mulai datang lagi"
          kembali="/jadwal"
        />
        <div className="space-y-7 px-4 pb-40 pt-5">
          <Kartu className="p-4">
            <p className="text-[15px] font-semibold">Jadwal sedang dijeda</p>
            <p className="mt-1 text-[14px] leading-snug text-ink-2">
              {jadwal.pausedUntil
                ? `Petugas berhenti datang sampai ${tanggalPendek(jadwal.pausedUntil)}. Setelah itu jadwal jalan lagi sendiri.`
                : "Petugas berhenti datang sampai kamu nyalakan lagi."}
            </p>
          </Kartu>

          <section className="space-y-3">
            <Label>Kalau dijalankan lagi</Label>
            <p className="rounded-kartu border border-line bg-card p-4 text-[15px] leading-relaxed">
              {kalimatRutin({ ...jadwal, isPaused: false })}
            </p>
          </section>

          <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto max-w-screen-sm">
              <Tombol lebar disabled={kirim} onClick={simpan}>
                {kirim ? "Menyimpan…" : "Jalankan jadwal lagi"}
              </Tombol>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Kop
        judul="Jeda jadwal"
        keterangan="Mis. saat keluar kota"
        kembali="/jadwal"
      />
      <div className="space-y-7 px-4 pb-44 pt-5">
        <section className="space-y-3">
          <Label>Jeda berapa lama</Label>
          <p className="-mt-1 text-[13px] leading-snug text-ink-2">
            Petugas berhenti datang selama jeda. Langganan tetap jalan.
          </p>
          <ul className="space-y-2">
            {PRESET.map((p) => {
              const aktif = p.id === pilihan;
              return (
                <li key={p.id}>
                  <label
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-kartu border p-3 ${
                      aktif
                        ? "border-hijau bg-hijau-tipis"
                        : "border-line bg-card hover:border-line-kuat"
                    }`}
                  >
                    <input
                      type="radio"
                      name="lama-jeda"
                      checked={aktif}
                      onChange={() => setPilihan(p.id)}
                      className="size-5 shrink-0 accent-hijau"
                    />
                    <span className="flex-1 text-[15px] font-semibold">
                      {p.label}
                    </span>
                    {aktif && p.hari !== null && sampai && (
                      <span className="angka shrink-0 text-[13px] font-semibold text-ink-2">
                        s/d {tanggalPendek(sampai)}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Akibatnya disebut lebih dulu, bukan dikejutkan setelah menekan. */}
        <section className="space-y-3">
          <Label>Yang ikut terpengaruh</Label>
          {terdampak.length === 0 ? (
            <Kartu className="p-4">
              <p className="text-[14px] leading-snug text-ink-2">
                Tidak ada jemput terjadwal di rentang itu.
              </p>
            </Kartu>
          ) : (
            <Kartu>
              <p className="border-b border-line p-3 text-[14px] leading-snug">
                <span className="font-semibold">{terdampak.length} jemput</span>{" "}
                di rentang jeda akan dibatalkan.
              </p>
              <ul className="divide-y divide-line">
                {terdampak.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 p-3 text-[14px]"
                  >
                    <span className="angka w-16 shrink-0 font-bold">
                      {hariPendek(p.pickupDate)} {tanggalPendek(p.pickupDate)}
                    </span>
                    <span className="truncate text-ink-2">
                      {tanggalPanjang(p.pickupDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </Kartu>
          )}
        </section>

        <p className="text-[13px] leading-snug text-ink-3">
          Butuh jemput sekali saja selama dijeda? Kamu tetap bisa memesan jemput
          tambahan kapan pun.
        </p>

        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-screen-sm">
            <Tombol lebar disabled={kirim} onClick={simpan}>
              {kirim ? "Menyimpan…" : "Jeda jadwal rutin"}
            </Tombol>
          </div>
        </div>
      </div>
    </>
  );
}
