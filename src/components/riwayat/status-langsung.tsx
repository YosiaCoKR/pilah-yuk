"use client";

import { useEffect, useState } from "react";
import {
  hentikanSimulasi,
  jedaSimulasiMs,
  mulaiSimulasi,
  setelSimulasi,
  useStatusLangsung,
} from "@/lib/toko-status";
import type { PickupStatus } from "@/lib/types";
import { LiniStatus } from "../lini-status";
import { Kartu } from "../primitif";
import { StatusJemput } from "../status-jemput";

const detik = Math.round(jedaSimulasiMs / 1000);

/**
 * Perjalanan pesanan yang bergerak sendiri.
 *
 * Status maju tanpa warga menyentuh apa pun, persis seperti nanti saat
 * Realtime terpasang. Panel simulasinya ditandai terang-terangan — layar yang
 * berubah sendiri tanpa penjelasan akan terbaca sebagai kerusakan, bukan
 * fitur.
 */
export function StatusLangsung({
  pickupId,
  statusAwal,
}: {
  pickupId: string;
  statusAwal: PickupStatus;
}) {
  const status = useStatusLangsung(pickupId, statusAwal);
  const [jalan, setJalan] = useState(false);

  /* Hentikan timer saat layar ditinggalkan — kalau tidak, ia terus berdetak
     di latar untuk pesanan yang sudah tidak dilihat siapa pun. */
  useEffect(() => () => hentikanSimulasi(), []);

  const selesai = status === "selesai" || status === "batal";

  return (
    <div className="space-y-2">
      <Kartu className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-ink-2">
            Status sekarang
          </span>
          <StatusJemput status={status} titik />
        </div>
        <LiniStatus sekarang={status} />
      </Kartu>

      {statusAwal !== "selesai" && statusAwal !== "batal" && (
        <Kartu className="border-dashed p-3">
          <p className="text-[13px] leading-snug text-ink-2">
            <span className="font-semibold text-ink">Mode simulasi.</span>{" "}
            Belum tersambung ke petugas sungguhan. Jalankan untuk melihat
            status maju sendiri tiap {detik} detik, seperti nanti saat petugas
            menekan tombolnya.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={jalan && !selesai}
              onClick={() => {
                setJalan(true);
                mulaiSimulasi(pickupId, "menunggu");
              }}
              className="min-h-10 flex-1 rounded-kartu border border-line-kuat bg-card px-3 text-[13px] font-semibold hover:bg-paper disabled:opacity-50"
            >
              {jalan && !selesai ? "Berjalan…" : "Jalankan simulasi"}
            </button>
            <button
              type="button"
              onClick={() => {
                setJalan(false);
                setelSimulasi(pickupId, statusAwal);
              }}
              className="min-h-10 rounded-kartu border border-line-kuat bg-card px-3 text-[13px] font-semibold hover:bg-paper"
            >
              Kembalikan
            </button>
          </div>
        </Kartu>
      )}
    </div>
  );
}
