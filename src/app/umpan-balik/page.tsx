import { Kop } from "@/components/kop";
import { DaftarUlasan } from "@/components/umpan-balik/daftar-ulasan";

export const metadata = { title: "Penilaianku — Pilah Yuk" };

export default function DaftarUlasanPage() {
  return (
    <>
      <Kop
        judul="Penilaianku"
        keterangan="Umpan balik untuk petugas"
        kembali="/profil"
      />
      <DaftarUlasan />
    </>
  );
}
