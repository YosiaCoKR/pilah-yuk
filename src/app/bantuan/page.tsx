import { DaftarFaq } from "@/components/bantuan/daftar-faq";
import { Kop } from "@/components/kop";
import { daftarChannel } from "@/lib/data";

export const metadata = { title: "Pusat bantuan — Pilah Yuk" };

export default async function BantuanPage() {
  const channel = (await daftarChannel()).find((c) => c.isMember) ?? null;
  return (
    <>
      <Kop
        judul="Pusat bantuan"
        keterangan="Pertanyaan yang sering ditanyakan"
        kembali="/profil"
      />
      <main className="space-y-7 px-4 pb-10 pt-5">
        <DaftarFaq channel={channel} />
      </main>
    </>
  );
}
