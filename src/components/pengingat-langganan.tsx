"use client";

import Link from "next/link";
import { useNilaiKlien } from "@/lib/klien";
import { parseISO, rupiah, tanggalPendek } from "@/lib/tanggal";
import type { Subscription } from "@/lib/types";

/** Whole days from today until `iso`. Negative once it has passed. */
function sisaHari(iso: string) {
  const a = parseISO(iso).setHours(0, 0, 0, 0);
  const b = new Date().setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86_400_000);
}

/**
 * Subscription notice. Three states, and the tone escalates only when it
 * needs to: a healthy subscription is a quiet line, an expiring one earns the
 * alarm colour. Says what will happen and by when — never just "expiring".
 */
export function PengingatLangganan({
  langganan,
  ringkas = false,
}: {
  langganan: Subscription;
  ringkas?: boolean;
}) {
  /* Days-remaining depends on today, so it is resolved on the client. */
  const sisa = useNilaiKlien(() => sisaHari(langganan.endDate), null);
  const kuotaSisa = Math.max(0, langganan.pickupQuota - langganan.pickupUsed);

  const habis = langganan.status === "kedaluwarsa";
  const belumBayar = langganan.status === "menunggu_bayar";
  // Fewer than 5 days or 1 pickup left is worth flagging before it bites.
  const segera =
    langganan.status === "aktif" &&
    ((sisa !== null && sisa <= 5) || kuotaSisa <= 1);
  const mendesak = habis || belumBayar || segera;

  const judul = habis
    ? "Langganan sudah habis"
    : belumBayar
      ? "Pembayaran belum selesai"
      : segera
        ? "Langganan segera berakhir"
        : "Langganan aktif";

  const pesan = habis
    ? "Perpanjang dulu supaya petugas bisa menjemput lagi."
    : belumBayar
      ? `Selesaikan pembayaran ${rupiah(langganan.price)} agar jemput bisa dijadwalkan.`
      : segera
        ? sisaKalimat(sisa, kuotaSisa, langganan.endDate)
        : `Berlaku sampai ${tanggalPendek(langganan.endDate)}. Sisa ${kuotaSisa} jemput.`;

  const aksi = habis || belumBayar ? "Perpanjang" : segera ? "Perpanjang" : "Kelola";

  return (
    <div
      className={`flex items-start gap-3 rounded-kartu border p-3 ${
        mendesak
          ? "border-alarm/45 bg-alarm-tipis"
          : "border-line bg-card"
      }`}
    >
      <span
        aria-hidden
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
          mendesak ? "bg-alarm" : "bg-hijau"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{judul}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{pesan}</p>
        {!ringkas && langganan.status === "aktif" && (
          <SisaKuota terpakai={langganan.pickupUsed} kuota={langganan.pickupQuota} />
        )}
      </div>
      <Link
        href="/langganan"
        className={`shrink-0 rounded-kartu border px-3 py-2 text-[13px] font-semibold ${
          mendesak
            ? "border-alarm bg-alarm text-white"
            : "border-line-kuat bg-card text-ink hover:bg-paper"
        }`}
      >
        {aksi}
      </Link>
    </div>
  );
}

function sisaKalimat(sisa: number | null, kuotaSisa: number, iso: string) {
  if (kuotaSisa === 0) return "Kuota jemput bulan ini sudah terpakai semua.";
  if (kuotaSisa === 1) return "Tinggal 1 jemput tersisa di paket ini.";
  if (sisa !== null && sisa <= 0) return "Berakhir hari ini.";
  if (sisa !== null) return `Berakhir ${sisa} hari lagi, ${tanggalPendek(iso)}.`;
  return `Berakhir ${tanggalPendek(iso)}.`;
}

/** Quota as discrete marks — warga count pickups, not percentages. */
function SisaKuota({ terpakai, kuota }: { terpakai: number; kuota: number }) {
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: kuota }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < terpakai ? "bg-hijau" : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-ink-2">
        {terpakai} dari {kuota} jemput terpakai
      </p>
    </div>
  );
}
