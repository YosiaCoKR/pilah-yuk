"use client";

import { useSyncExternalStore } from "react";
import { PAKET, SUBSCRIPTION, paketTerpakai } from "./mock";
import { geserHari, hariIniISO } from "./tanggal";
import type { Plan, Subscription } from "./types";

/**
 * Langganan warga selama satu sesi.
 *
 * Ganti paket melewati halaman pembayaran, jadi keadaannya harus selamat dari
 * perpindahan halaman — useState di satu layar akan hilang begitu warga sampai
 * di /langganan/bayar dan kembali. Hilang saat halaman dimuat ulang, dan itu
 * memang yang diharapkan dari data tiruan.
 *
 * Saat API-nya siap, berkas ini ditukar dengan panggilan ke
 * `/api/langganan` tanpa menyentuh komponen yang memakainya.
 */

let langganan: Subscription = SUBSCRIPTION;
const pendengar = new Set<() => void>();

const tulis = (ubah: Partial<Subscription>) => {
  langganan = { ...langganan, ...ubah };
  for (const dengar of pendengar) dengar();
};

function langgan(dengar: () => void) {
  pendengar.add(dengar);
  return () => pendengar.delete(dengar);
}

/** Lama satu periode paket, dalam hari. */
const lamaPeriode = (paket: Plan) =>
  paket.billingCycle === "mingguan" ? 7 : 30;

/**
 * Paket dipilih, tinggal dibayar.
 *
 * Paket baru menggantikan yang sekarang, bukan mengantre di belakangnya — satu
 * keadaan, jadi tidak ada "paket terjadwal" yang harus ditampilkan dan
 * dibatalkan di mana-mana. Kuotanya ikut disetel ulang; tanpa itu pemakaian
 * paket lama terbawa dan layar mencetak "6 dari 4 jemput terpakai".
 */
export function pilihPaket(paketId: string) {
  const paket = PAKET.find((p) => p.id === paketId);
  if (!paket || !paket.isActive) return;
  tulis({
    planName: paket.name,
    billingCycle: paket.billingCycle,
    price: paket.price,
    pickupQuota: paket.pickupQuota,
    pickupUsed: 0,
    status: "menunggu_bayar",
  });
}

/**
 * Pembayaran terbaca: periode baru berjalan.
 *
 * Kalau langganannya masih aktif — warga memperpanjang lebih awal — periode
 * baru disambung dari tanggal berakhir, bukan dari hari ini. Menyetelnya ke
 * hari ini akan menghanguskan sisa hari yang sudah dibayar.
 *
 * Ganti paket lain tidak lewat jalur itu: `pilihPaket` sudah menandainya
 * `menunggu_bayar`, jadi periodenya memang mulai hari ini.
 */
export function konfirmasiPembayaran() {
  const paket = paketTerpakai(langganan);
  const hariIni = hariIniISO();
  const mulai =
    langganan.status === "aktif" && langganan.endDate > hariIni
      ? langganan.endDate
      : hariIni;
  tulis({
    status: "aktif",
    startDate: mulai,
    /* Periode baru, kuota penuh lagi. */
    pickupUsed: 0,
    endDate: geserHari(mulai, paket ? lamaPeriode(paket) : 30),
  });
}

export const setelPerpanjangOtomatis = (nyala: boolean) =>
  tulis({ autoRenew: nyala });

export function useLangganan(): Subscription {
  return useSyncExternalStore(
    langgan,
    () => langganan,
    () => SUBSCRIPTION,
  );
}
