"use client";

import type { ReactNode } from "react";
import { tanggalPendek } from "@/lib/tanggal";
import { useLangganan } from "@/lib/toko-langganan";
import { TombolLink } from "./tombol";

/**
 * Gerbang untuk aksi yang menjadwalkan jemput.
 *
 * Tanpa paket yang berjalan, jemput tidak akan pernah datang — jadi tombolnya
 * diganti jalan keluar, bukan dibiarkan bisa ditekan lalu ditolak di ujung.
 * Alasannya disebut di tempat yang sama: warga yang cuma melihat tombol
 * berubah akan mengira aplikasinya rusak.
 *
 * Kuota habis ikut ditahan di sini. Status masih "aktif", tapi hasilnya sama
 * bagi warga: tidak ada jemput yang bisa dipesan sampai periode berikutnya.
 */
export function GerbangLangganan({
  children,
  /* Jadwal rutin berlaku untuk periode-periode berikutnya, jadi kuota yang
     habis hari ini tidak membuatnya sia-sia — yang ditahan cuma pesanan
     sekali jalan. */
  perluKuota = true,
}: {
  children: ReactNode;
  perluKuota?: boolean;
}) {
  const langganan = useLangganan();
  const kuotaHabis =
    perluKuota && langganan.pickupQuota - langganan.pickupUsed <= 0;

  if (langganan.status === "aktif" && !kuotaHabis) return <>{children}</>;

  const [alasan, aksi] =
    langganan.status === "menunggu_bayar"
      ? [
          "Pembayaran paketmu belum selesai, jadi jemput belum bisa dijadwalkan.",
          "Selesaikan pembayaran",
        ]
      : langganan.status === "kedaluwarsa"
        ? [
            "Langganan sudah habis, jadi jemput belum bisa dijadwalkan.",
            "Perpanjang langganan",
          ]
        : [
            `Kuota jemput paket ini sudah terpakai semua. Periode berikutnya mulai ${tanggalPendek(langganan.endDate)}.`,
            "Lihat paket lain",
          ];

  return (
    <>
      <p className="mb-2 text-[13px] leading-snug text-ink-2">{alasan}</p>
      <TombolLink href="/langganan" lebar>
        {aksi}
      </TombolLink>
    </>
  );
}
