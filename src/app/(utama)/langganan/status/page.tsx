import { Kop } from "@/components/kop";
import { StatusLangganan } from "@/components/langganan/status-langganan";

export const metadata = { title: "Status langganan — Pilah Yuk" };

export default function StatusLanggananPage() {
  return (
    <>
      <Kop judul="Status langganan" kembali="/langganan" />
      <StatusLangganan />
    </>
  );
}
