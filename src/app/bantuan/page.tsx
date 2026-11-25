import { DaftarFaq } from "@/components/bantuan/daftar-faq";
import { Kop } from "@/components/kop";
import { Kartu } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";

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

        <Kartu className="p-4">
          <p className="text-[15px] font-semibold">Belum terjawab?</p>
          <p className="mt-1 text-[14px] leading-snug text-ink-2">
            Tanyakan di papan diskusi channel RT/RW-mu. Pengurus dan warga lain
            biasanya membalas di hari yang sama.
          </p>
          <div className="mt-4">
            <TombolLink href="/channel" varian="garis" lebar>
              Buka channel
            </TombolLink>
          </div>
        </Kartu>
      </main>
    </>
  );
}
