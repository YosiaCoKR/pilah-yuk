"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addressById, categoryByKey, slotById } from "@/lib/mock";
import { bulanPendekDari, bulanTahun, hariPendek, parseISO } from "@/lib/tanggal";
import { StatusJemput } from "../status-jemput";
import type { Pickup } from "@/lib/types";
import { IkonCari, IkonLanjut, IkonTutup } from "../ikon";
import { ChipSampah, Kartu } from "../primitif";

type Saring = "semua" | "selesai" | "batal";

const SARINGAN: { id: Saring; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "selesai", label: "Selesai" },
  { id: "batal", label: "Dibatalkan" },
];

const kg = (n: number) =>
  n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function DaftarRiwayat({ pickups }: { pickups: Pickup[] }) {
  const [saring, setSaring] = useState<Saring>("semua");
  const [cari, setCari] = useState("");

  /* Riwayat = yang sudah berakhir. Jemput mendatang punya halamannya sendiri. */
  const selesaiSemua = useMemo(
    () =>
      pickups
        .filter((p) => p.status === "selesai" || p.status === "batal")
        .sort((a, b) => b.pickupDate.localeCompare(a.pickupDate)),
    [pickups],
  );

  const tampil = useMemo(() => {
    const perStatus =
      saring === "semua"
        ? selesaiSemua
        : selesaiSemua.filter((p) => p.status === saring);

    const q = cari.trim().toLowerCase();
    if (!q) return perStatus;

    /* Dicari lewat kode, alamat, petugas, catatan, dan jenis sampah — semua
       yang mungkin diingat warga saat mencari satu pengangkutan tertentu. */
    return perStatus.filter((p) => {
      const alamat = addressById(p.addressId);
      return [
        p.code,
        alamat?.label,
        alamat?.fullAddress,
        p.officerName,
        p.notes,
        ...p.categories.map((k) => categoryByKey(k).name),
      ]
        .filter(Boolean)
        .some((t) => t!.toLowerCase().includes(q));
    });
  }, [selesaiSemua, saring, cari]);

  /* Dikelompokkan per bulan, dengan total berat tiap bulan — angka yang
     dibawa warga ke rapat RT, bukan sekadar daftar. */
  const perBulan = useMemo(() => {
    const peta = new Map<string, Pickup[]>();
    for (const p of tampil) {
      const kunci = bulanTahun(p.pickupDate);
      peta.set(kunci, [...(peta.get(kunci) ?? []), p]);
    }
    return [...peta.entries()];
  }, [tampil]);

  const jumlahSaring = (s: Saring) =>
    s === "semua"
      ? selesaiSemua.length
      : selesaiSemua.filter((p) => p.status === s).length;

  return (
    <div className="space-y-5">
      <div className="relative">
        <IkonCari
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3"
        />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari kode, alamat, petugas, jenis"
          aria-label="Cari riwayat"
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

      {/* Membungkus, bukan menggulir: tiga saringan harus terlihat semua —
          yang tersembunyi di balik gulir tidak akan pernah ditekan. Layar
          320px masih umum di HP murah. */}
      <ul
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Saring riwayat"
      >
        {SARINGAN.map((s) => {
          const aktif = s.id === saring;
          return (
            <li key={s.id}>
              <button
                type="button"
                role="tab"
                aria-selected={aktif}
                onClick={() => setSaring(s.id)}
                className={`flex min-h-10 items-center gap-1.5 rounded-kartu border px-3 text-[14px] font-semibold ${
                  aktif
                    ? "border-hijau bg-hijau text-white"
                    : "border-line bg-card text-ink-2 hover:border-line-kuat"
                }`}
              >
                {s.label}
                <span className={aktif ? "text-white/70" : "text-ink-3"}>
                  {jumlahSaring(s.id)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {tampil.length === 0 ? (
        <Kartu className="p-6 text-center">
          {cari.trim() ? (
            <>
              <p className="text-[15px] font-semibold">
                Tidak ada yang cocok
              </p>
              <p className="mt-1 text-[13px] leading-snug text-ink-2">
                Tidak ada riwayat yang cocok dengan “{cari.trim()}”. Coba kata
                lain, atau hapus pencarian untuk melihat semuanya.
              </p>
              <button
                type="button"
                onClick={() => setCari("")}
                className="mt-3 min-h-11 rounded-kartu border border-line-kuat bg-card px-4 text-[14px] font-semibold hover:bg-paper"
              >
                Hapus pencarian
              </button>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold">Belum ada riwayat</p>
              <p className="mt-1 text-[13px] leading-snug text-ink-2">
                Setelah petugas selesai mengangkut, catatannya muncul di sini
                lengkap dengan berat dan buktinya.
              </p>
            </>
          )}
        </Kartu>
      ) : (
        perBulan.map(([bulan, isi]) => {
          const totalKg = isi.reduce((n, p) => n + (p.totalWeightKg ?? 0), 0);
          const jumlahSelesai = isi.filter(
            (p) => p.status === "selesai",
          ).length;

          return (
            <section key={bulan} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[14px] font-bold">{bulan}</h2>
                {totalKg > 0 && (
                  <p className="text-[13px] text-ink-2">
                    <span className="angka font-bold text-ink">
                      {kg(totalKg)} kg
                    </span>{" "}
                    dari {jumlahSelesai} jemput
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                {isi.map((p) => (
                  <li key={p.id}>
                    <BarisRiwayat pickup={p} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function BarisRiwayat({ pickup }: { pickup: Pickup }) {
  const alamat = addressById(pickup.addressId);
  const slot = slotById(pickup.timeSlotId);
  const d = parseISO(pickup.pickupDate);
  const batal = pickup.status === "batal";

  return (
    <Link
      href={`/riwayat/${pickup.id}`}
      className="flex items-stretch overflow-hidden rounded-kartu border border-line bg-card hover:border-line-kuat"
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-line bg-paper py-3">
        <span className="text-[11px] font-semibold text-ink-3">
          {hariPendek(pickup.pickupDate)}
        </span>
        <span className="angka text-[22px] font-extrabold leading-none">
          {String(d.getDate()).padStart(2, "0")}
        </span>
        <span className="text-[11px] text-ink-3">
          {bulanPendekDari(pickup.pickupDate)}
        </span>
      </div>

      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Berat adalah yang dicari warga di riwayat, jadi ia yang besar. */}
          {batal ? (
            <span className="text-[15px] font-semibold text-ink-3">
              Tidak jadi diangkut
            </span>
          ) : (
            <span className="angka text-[18px] font-extrabold">
              {kg(pickup.totalWeightKg ?? 0)} kg
            </span>
          )}
          <StatusJemput status={pickup.status} ringkas />
        </div>

        <p className="mt-0.5 truncate text-[13px] text-ink-2">
          {alamat?.label} · {slot?.range}
          {pickup.officerName && ` · ${pickup.officerName}`}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {pickup.categories.map((k) => (
            <ChipSampah key={k} jenis={k} ukuran="sm" />
          ))}
        </div>
      </div>

      <span className="flex items-center pr-2 text-ink-3" aria-hidden>
        <IkonLanjut className="size-5" />
      </span>
    </Link>
  );
}
