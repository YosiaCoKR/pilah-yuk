"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { PickupStatus } from "@/lib/types";
import { LiniStatus } from "../lini-status";
import { Kartu } from "../primitif";
import { StatusJemput } from "../status-jemput";

/** Seberapa sering layar menanyakan status ke server. */
const SELANG_MS = 30_000;

/**
 * Perjalanan pesanan. Selama belum berakhir, halaman dibaca ulang berkala
 * supaya status ikut maju saat petugas menekan tombolnya.
 * ponytail: polling 30 detik; ganti Supabase Realtime kalau perlu seketika.
 */
export function StatusLangsung({ status }: { status: PickupStatus }) {
  const router = useRouter();
  const berakhir = status === "selesai" || status === "batal";

  useEffect(() => {
    if (berakhir) return;
    const t = setInterval(() => router.refresh(), SELANG_MS);
    return () => clearInterval(t);
  }, [berakhir, router]);

  return (
    <Kartu className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-2">
          Status sekarang
        </span>
        <StatusJemput status={status} titik />
      </div>
      <LiniStatus sekarang={status} />
    </Kartu>
  );
}
