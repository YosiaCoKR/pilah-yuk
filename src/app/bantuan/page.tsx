import { DaftarFaq } from "@/components/bantuan/daftar-faq";
import { Kop } from "@/components/kop";

export const metadata = { title: "Pusat bantuan — Pilah Yuk" };

export default function BantuanPage() {
  return (
    <>
      <Kop
        judul="Pusat bantuan"
        keterangan="Pertanyaan yang sering ditanyakan"
        kembali="/profil"
      />
      <main className="space-y-7 px-4 pb-10 pt-5">
        <DaftarFaq />
      </main>
    </>
  );
}
