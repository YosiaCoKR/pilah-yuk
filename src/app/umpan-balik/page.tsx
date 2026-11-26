import { Kop } from "@/components/kop";
import { DaftarUlasan } from "@/components/umpan-balik/daftar-ulasan";
import { umpanBalik } from "@/lib/data";

export const metadata = { title: "Penilaianku — Pilah Yuk" };

export default async function DaftarUlasanPage() {
  const data = await umpanBalik();
  return (
    <>
      <Kop
        judul="Penilaianku"
        keterangan="Umpan balik untuk petugas"
        kembali="/profil"
      />
      <DaftarUlasan {...data} />
    </>
  );
}
