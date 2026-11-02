import { LayarLangganan } from "@/components/langganan/layar-langganan";
import { SUBSCRIPTION } from "@/lib/mock";

export const metadata = { title: "Langganan — Pilah Yuk" };

export default function LanggananPage() {
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-[22px] font-bold leading-tight">Langganan</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">
          Kuota jemput, paket, dan perpanjangan.
        </p>
      </header>

      <LayarLangganan awal={SUBSCRIPTION} />
    </main>
  );
}
