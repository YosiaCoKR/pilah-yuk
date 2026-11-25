import { IkonLanjut } from "@/components/ikon";
import { Kop } from "@/components/kop";
import { Kartu, Label } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { FAQ } from "@/lib/mock";

export const metadata = { title: "Pusat bantuan — Pilah Yuk" };

export default function BantuanPage() {
  const topik = [...new Set(FAQ.map((f) => f.topik))];
  return (
    <>
      <Kop
        judul="Pusat bantuan"
        keterangan="Pertanyaan yang sering ditanyakan"
        kembali="/profil"
      />
      <main className="space-y-7 px-4 pb-10 pt-5">
        {topik.map((t) => (
          <section key={t} className="space-y-3">
            <Label>{t}</Label>
            {/* <details> bawaan: buka-tutup tanpa JavaScript, jalan di
                koneksi lambat, dan dibaca benar oleh pembaca layar. */}
            <Kartu className="divide-y divide-line">
              {FAQ.filter((f) => f.topik === t).map((f) => (
                <details key={f.tanya} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{f.tanya}</span>
                    <IkonLanjut className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-4 pb-4 text-[14px] leading-relaxed text-ink-2">
                    {f.jawab}
                  </p>
                </details>
              ))}
            </Kartu>
          </section>
        ))}

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
