import { DaftarRiwayat } from "@/components/riwayat/daftar-riwayat";
import { SEMUA_PICKUP } from "@/lib/mock";

export const metadata = { title: "Riwayat — Pilah Yuk" };

export default function RiwayatPage() {
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-[22px] font-bold leading-tight">Riwayat</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">
          Catatan semua pengangkutan beserta beratnya.
        </p>
      </header>

      <DaftarRiwayat pickups={SEMUA_PICKUP} />
    </main>
  );
}
