"use client";

import Link from "next/link";
import { useState } from "react";
import {
  hargaPerJemput,
  iramaJemput,
  satuanSiklus,
} from "@/lib/kalimat";
import { useNilaiKlien } from "@/lib/klien";
import { PAKET, paketTerpakai } from "@/lib/mock";
import { parseISO, rupiah, tanggalPendek } from "@/lib/tanggal";
import {
  pilihPaket,
  setelPerpanjangOtomatis,
  useLangganan,
} from "@/lib/toko-langganan";
import type { Subscription } from "@/lib/types";
import { Lembar } from "../lembar";
import { Kartu, Label, Perforasi } from "../primitif";
import { Sakelar } from "../sakelar";
import { Tombol, TombolLink } from "../tombol";

/** Sisa hari sampai `iso`; negatif kalau sudah lewat. */
function sisaHari(iso: string) {
  const a = parseISO(iso).setHours(0, 0, 0, 0);
  const b = new Date().setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86_400_000);
}

export function LayarLangganan({ awal }: { awal: Subscription }) {
  /* Dibaca dari store sesi, bukan useState: ganti paket melewati halaman
     pembayaran, dan keadaannya harus selamat dari perpindahan halaman. */
  const langganan = useLangganan();
  const [pilihan, setPilihan] = useState(
    () => paketTerpakai(awal)?.id ?? PAKET.find((p) => p.isActive)!.id,
  );
  const [lembarBuka, setLembarBuka] = useState(false);

  const terpakai = paketTerpakai(langganan);
  const dipilih = PAKET.find((p) => p.id === pilihan)!;
  const gantiPaket = terpakai?.id !== dipilih.id;

  const sisaKuota = Math.max(0, langganan.pickupQuota - langganan.pickupUsed);
  const sisa = useNilaiKlien(() => sisaHari(langganan.endDate), null);

  const belumBayar = langganan.status === "menunggu_bayar";
  const habis = langganan.status === "kedaluwarsa";

  /* Diperlakukan sebagai pembayaran yang selesai. Di layar sungguhan ini
     tempat halaman pembayaran mengambil alih. */
  /* Paket dicatat dulu sebagai "menunggu bayar", baru pindah ke halaman
     pembayaran. Warga yang mundur di tengah jalan tetap menemukan pilihannya,
     bukan kembali ke paket lama tanpa penjelasan. */
  const tautanBayar = `/langganan/bayar?paket=${dipilih.id}`;

  return (
    <div className="space-y-7">
      {/* Struk langganan: separuh atas menjawab "berapa jemput lagi punya
          saya", separuh bawah "apa yang saya bayar dan sampai kapan". */}
      <Kartu className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-2">Sisa jemput</p>
            <p className="angka mt-1 text-[44px] font-extrabold leading-[1]">
              {sisaKuota}
            </p>
            <p className="text-[14px] text-ink-2">
              dari {langganan.pickupQuota} jemput paket ini
            </p>
          </div>
          <span
            className={`shrink-0 rounded-kartu border px-2.5 py-1 text-[12px] font-semibold ${
              belumBayar || habis
                ? "border-alarm/45 bg-alarm-tipis text-alarm"
                : "border-line bg-paper text-ink-2"
            }`}
          >
            {belumBayar ? "Belum dibayar" : habis ? "Habis" : "Aktif"}
          </span>
        </div>

        <div className="px-4 pb-3">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: langganan.pickupQuota }, (_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < langganan.pickupUsed ? "bg-hijau" : "bg-line"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-ink-2">
            {langganan.pickupUsed} dari {langganan.pickupQuota} jemput terpakai
          </p>
        </div>

        <div className="py-1">
          <Perforasi />
        </div>

        <div className="space-y-3 p-4 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-semibold leading-snug">
              {langganan.planName}
            </p>
            <p className="angka shrink-0 text-[17px] font-bold">
              {rupiah(langganan.price)}
              <span className="text-[13px] font-semibold text-ink-2">
                /{satuanSiklus(langganan.billingCycle)}
              </span>
            </p>
          </div>

          <p className="text-[13px] leading-snug text-ink-2">
            {belumBayar
              ? `Selesaikan pembayaran ${rupiah(langganan.price)} supaya jemput bisa dijadwalkan lagi.`
              : habis
                ? "Petugas berhenti menjemput sampai paket diperpanjang."
                : sisa !== null && sisa <= 0
                  ? `Berakhir hari ini, ${tanggalPendek(langganan.endDate)}.`
                  : sisa !== null
                    ? `Berlaku sampai ${tanggalPendek(langganan.endDate)} — ${sisa} hari lagi.`
                    : `Berlaku sampai ${tanggalPendek(langganan.endDate)}.`}
          </p>

          <p className="text-[13px] text-ink-3">
            Aktif sejak {tanggalPendek(langganan.startDate)}
          </p>

          <Link
            href="/langganan/status"
            className="inline-block text-[13px] font-semibold text-hijau"
          >
            Lihat status &amp; riwayat tagihan
          </Link>

          {terpakai && (
            <TombolLink
              lebar
              /* Perpanjang = paket yang sama, jadi `pilihPaket` tidak dipanggil:
                 statusnya tetap aktif, dan sisa harinya ikut terbawa. */
              href={`/langganan/bayar?paket=${terpakai.id}`}
              varian={belumBayar || habis ? "utama" : "garis"}
            >
              {belumBayar
                ? `Bayar ${rupiah(langganan.price)}`
                : habis
                  ? "Perpanjang langganan"
                  : `Perpanjang sekarang, ${rupiah(langganan.price)}`}
            </TombolLink>
          )}
        </div>
      </Kartu>

      <section className="space-y-3">
        <Label>Pilih paket</Label>

        <ul className="space-y-2">
          {PAKET.map((paket) => {
            const ini = paket.id === pilihan;
            const sedangDipakai = paket.id === terpakai?.id;
            /* Paket yang ditarik tapi masih dipakai warga tetap bisa dibaca
               seperti biasa — yang ditutup cuma pintu masuknya. */
            const tertutup = !paket.isActive && !sedangDipakai;
            return (
              <li key={paket.id}>
                <label
                  className={`flex items-start gap-3 rounded-kartu border p-3 ${
                    tertutup
                      ? "cursor-not-allowed border-line bg-paper"
                      : ini
                        ? "cursor-pointer border-hijau bg-card"
                        : "cursor-pointer border-line bg-card hover:border-line-kuat"
                  }`}
                >
                  <input
                    type="radio"
                    name="paket"
                    value={paket.id}
                    checked={ini}
                    disabled={tertutup}
                    onChange={() => setPilihan(paket.id)}
                    className="mt-1 size-5 shrink-0 accent-hijau disabled:opacity-40"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[15px] font-semibold ${tertutup ? "text-ink-3" : ""}`}
                      >
                        {paket.name}
                      </span>
                      {sedangDipakai && (
                        <span className="rounded-kartu border border-hijau/45 bg-hijau-tipis px-1.5 py-0.5 text-[11px] font-semibold text-hijau">
                          Paket kamu
                        </span>
                      )}
                      {tertutup && (
                        <span className="rounded-kartu border border-line-kuat bg-card px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
                          Belum tersedia
                        </span>
                      )}
                    </span>
                    <span
                      className={`mt-0.5 block text-[13px] ${tertutup ? "text-ink-3" : "text-ink-2"}`}
                    >
                      {iramaJemput(paket)}
                    </span>
                    {/* Alasannya disebut, bukan sekadar diredupkan: warga yang
                        melihat paket mati tanpa sebab akan menekannya lagi. */}
                    {tertutup && (
                      <span className="mt-1 block text-[12px] leading-snug text-ink-2">
                        Armada RW kamu belum melayani paket sebesar ini.
                      </span>
                    )}
                    {!paket.isActive && sedangDipakai && (
                      <span className="mt-1 block text-[12px] leading-snug text-ink-2">
                        Paket ini sudah tidak ditawarkan lagi. Tetap berjalan
                        sampai masa aktifnya habis.
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`angka block text-[16px] font-bold ${tertutup ? "text-ink-3" : ""}`}
                    >
                      {rupiah(paket.price)}
                    </span>
                    {/* Harga per jemput itu angka pembanding. Di paket yang
                        tidak bisa dipilih ia tidak membandingkan apa pun. */}
                    {!tertutup && (
                      <span className="mt-0.5 block text-[12px] text-ink-2">
                        {rupiah(hargaPerJemput(paket))}/jemput
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {gantiPaket && (
          <Tombol
            lebar
            onClick={() => setLembarBuka(true)}
            className="min-h-14 text-[16px]"
          >
            Ganti ke {dipilih.name}
          </Tombol>
        )}
      </section>

      <section className="space-y-3">
        <Label>Pengaturan</Label>
        <Sakelar
          nyala={langganan.autoRenew}
          onUbah={setelPerpanjangOtomatis}
          judul="Perpanjang otomatis"
          keterangan={`Ditagih ${rupiah(langganan.price)} tiap ${satuanSiklus(langganan.billingCycle)}, mulai ${tanggalPendek(langganan.endDate)}.`}
          matikanKeterangan="Jemput berhenti saat paket habis, sampai kamu perpanjang sendiri."
        />
      </section>

      <Lembar
        buka={lembarBuka}
        onTutup={() => setLembarBuka(false)}
        judul={gantiPaket ? "Ganti paket" : "Perpanjang paket"}
      >
        <div className="space-y-4">
          <Kartu className="divide-y divide-line">
            <Baris kiri="Paket" kanan={dipilih.name} />
            <Baris kiri="Kuota jemput" kanan={iramaJemput(dipilih)} />
            <Baris
              kiri="Ditagih"
              kanan={`${rupiah(dipilih.price)} / ${satuanSiklus(dipilih.billingCycle)}`}
              tebal
            />
          </Kartu>

          <div className="space-y-2 text-[13px] leading-snug text-ink-2">
            <p>
              Pembayaran lewat QRIS, e-wallet, atau transfer bank. Kuota paket
              baru masuk begitu pembayaran terbaca — biasanya di bawah satu
              menit.
            </p>
            {gantiPaket && langganan.status === "aktif" && sisaKuota > 0 && (
              <p>
                Paket baru langsung menggantikan yang sekarang, jadi {sisaKuota}{" "}
                jemput yang belum terpakai tidak ikut terbawa.
              </p>
            )}
          </div>

          <TombolLink
            lebar
            href={tautanBayar}
            onClick={() => pilihPaket(dipilih.id)}
            className="min-h-14 text-[16px]"
          >
            Lanjut ke pembayaran
          </TombolLink>
        </div>
      </Lembar>
    </div>
  );
}

function Baris({
  kiri,
  kanan,
  tebal = false,
}: {
  kiri: string;
  kanan: string;
  tebal?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
      <span className="text-[13px] text-ink-2">{kiri}</span>
      <span
        className={`text-right text-[14px] ${tebal ? "angka text-[16px] font-bold" : "font-semibold"}`}
      >
        {kanan}
      </span>
    </div>
  );
}
