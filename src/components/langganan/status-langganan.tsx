"use client";

import Link from "next/link";
import { satuanSiklus } from "@/lib/kalimat";
import { useNilaiKlien } from "@/lib/klien";
import { TAGIHAN } from "@/lib/mock";
import { parseISO, rupiah, tanggalPendek } from "@/lib/tanggal";
import { useLangganan } from "@/lib/toko-langganan";
import { Kartu, Label, Perforasi } from "../primitif";
import { DaftarTagihan } from "./daftar-tagihan";
import { TombolLink } from "../tombol";

/** Sisa hari sampai `iso`; negatif kalau sudah lewat. */
function sisaHari(iso: string) {
  const a = parseISO(iso).setHours(0, 0, 0, 0);
  const b = new Date().setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86_400_000);
}

export function StatusLangganan() {
  const langganan = useLangganan();
  const sisa = useNilaiKlien(() => sisaHari(langganan.endDate), null);

  const aktif = langganan.status === "aktif";
  const sisaKuota = Math.max(0, langganan.pickupQuota - langganan.pickupUsed);
  const akhir = tanggalPendek(langganan.endDate);

  /* Apa yang terjadi di tanggal berakhir — itu yang dicari warga di halaman
     ini, bukan tanggalnya saja. */
  const nanti = !aktif
    ? "Jemput berhenti sampai pembayaran selesai."
    : langganan.autoRenew
      ? `Diperpanjang otomatis ${akhir}, ditagih ${rupiah(langganan.price)}.`
      : `Berhenti ${akhir}. Perpanjang sendiri kalau mau lanjut.`;

  return (
    <main className="space-y-7 pb-10 pt-5">
      <Kartu className="overflow-hidden">
        <div className="p-4 pb-3">
          <p className="text-[13px] font-semibold text-ink-2">
            Periode berjalan
          </p>
          <p className="angka mt-1 text-[26px] font-extrabold leading-tight">
            {tanggalPendek(langganan.startDate)} – {akhir}
          </p>
          <p className="text-[14px] text-ink-2">
            {sisa === null
              ? "Tanggal berakhir periode ini."
              : sisa > 0
                ? `${sisa} hari lagi`
                : sisa === 0
                  ? "Berakhir hari ini"
                  : `Lewat ${Math.abs(sisa)} hari`}
          </p>
        </div>

        <div className="py-1">
          <Perforasi />
        </div>

        <dl className="divide-y divide-line">
          <Baris kiri="Paket" kanan={langganan.planName} />
          <Baris
            kiri="Tagihan"
            kanan={`${rupiah(langganan.price)}/${satuanSiklus(langganan.billingCycle)}`}
          />
          <Baris
            kiri="Kuota jemput"
            kanan={`${sisaKuota} sisa dari ${langganan.pickupQuota}`}
          />
          <Baris
            kiri="Status"
            kanan={
              aktif
                ? "Aktif"
                : langganan.status === "menunggu_bayar"
                  ? "Belum dibayar"
                  : "Habis"
            }
          />
        </dl>
      </Kartu>

      <section className="space-y-3">
        <Label>Setelah periode ini</Label>
        <Kartu className="p-4">
          <p className="text-[14px] leading-snug">{nanti}</p>
          <div className="mt-3">
            <TombolLink varian="garis" href="/langganan">
              Atur paket &amp; perpanjangan
            </TombolLink>
          </div>
        </Kartu>
      </section>

      <section className="space-y-3">
        {/* Dipotong dua: halaman ini tentang periode berjalan, dan tagihan
            lamanya punya halamannya sendiri. */}
        <Label
          aksi={
            TAGIHAN.length > 2 ? (
              <Link
                href="/langganan/tagihan"
                className="text-[13px] font-semibold text-hijau"
              >
                Semua {TAGIHAN.length}
              </Link>
            ) : undefined
          }
        >
          Riwayat tagihan
        </Label>
        <DaftarTagihan tagihan={TAGIHAN.slice(0, 2)} />
      </section>
    </main>
  );
}

function Baris({ kiri, kanan }: { kiri: string; kanan: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="text-[13px] text-ink-2">{kiri}</dt>
      <dd className="text-right text-[14px] font-semibold">{kanan}</dd>
    </div>
  );
}
