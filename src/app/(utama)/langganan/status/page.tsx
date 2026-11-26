import { redirect } from "next/navigation";
import { Kop } from "@/components/kop";
import { StatusLangganan } from "@/components/langganan/status-langganan";
import { daftarTagihan, langgananku } from "@/lib/data";

export const metadata = { title: "Status langganan — Pilah Yuk" };

export default async function StatusLanggananPage() {
  const [langganan, tagihan] = await Promise.all([
    langgananku(),
    daftarTagihan(),
  ]);
  /* Belum berlangganan: tidak ada periode untuk ditampilkan. */
  if (!langganan) redirect("/langganan");
  return (
    <>
      <Kop judul="Status langganan" kembali="/langganan" />
      <StatusLangganan langganan={langganan} tagihan={tagihan} />
    </>
  );
}
