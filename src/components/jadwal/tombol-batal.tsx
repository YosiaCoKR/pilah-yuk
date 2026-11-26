"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { kirim } from "@/lib/kirim";

/** Batalkan satu pesanan yang masih menunggu. Server menolak yang lain. */
export function TombolBatal({ pickupId }: { pickupId: string }) {
  const router = useRouter();
  const [galat, setGalat] = useState<string | null>(null);
  const [jalan, mulai] = useTransition();

  function batalkan() {
    if (!confirm("Batalkan jemput ini? Petugas tidak akan datang.")) return;
    mulai(async () => {
      const h = await kirim("PUT", `/api/pesanan/${pickupId}/batal`);
      if (!h.ok) return setGalat(h.pesan);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={batalkan}
        disabled={jalan}
        className="flex min-h-12 w-full items-center justify-center rounded-kartu border border-alarm/50 bg-card text-[15px] font-semibold text-alarm hover:bg-alarm-tipis disabled:opacity-50"
      >
        {jalan ? "Membatalkan…" : "Batalkan jemput"}
      </button>
      {galat && (
        <p role="alert" className="text-center text-[13px] text-alarm">
          {galat}
        </p>
      )}
    </>
  );
}
