import { CariBenda } from "@/components/panduan/cari-benda";
import { Kartu, Label } from "@/components/primitif";
import { gabung } from "@/lib/kalimat";
import { WASTE_CATEGORIES, WASTE_COLOR, contohBenda } from "@/lib/mock";
import type { WasteCategory } from "@/lib/types";

export const metadata = { title: "Panduan pilah — Pilah Yuk" };

export default function PanduanPage() {
  /* Campuran dipisah dari tiga yang lain: ia bukan tong yang dituju, tapi
     yang tersisa kalau tidak sempat memilah — dan itu punya ongkos. */
  const terpilah = WASTE_CATEGORIES.filter((k) => k.key !== "campuran");
  const campuran = WASTE_CATEGORIES.find((k) => k.key === "campuran")!;

  return (
    <main className="space-y-7">
      <header>
        <h1 className="text-[22px] font-bold leading-tight">Panduan pilah</h1>
        <p className="mt-0.5 text-[14px] leading-snug text-ink-2">
          Cari bendanya, atau baca empat jenisnya di bawah.
        </p>
      </header>

      <CariBenda />

      <section className="space-y-3">
        <Label>Dipilah di rumah</Label>
        <ul className="space-y-2">
          {terpilah.map((kategori) => (
            <BarisKategori key={kategori.key} kategori={kategori} />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <Label>Kalau tidak sempat memilah</Label>
        <BarisKategori kategori={campuran} as="div" />
        <p className="text-[13px] leading-snug text-ink-3">
          Jemputnya tetap jalan — petugas RW yang memilah ulang di TPS, jadi
          karung campuran menunggu paling akhir.
        </p>
      </section>
    </main>
  );
}

/**
 * Satu jenis sampah, dibaca seperti label tong: pita warna di tepi kiri
 * membawa identitasnya, persis warna yang dipakai di seluruh aplikasi.
 *
 * Urutan isinya mengikuti urutan pertanyaan warga — ini apa, benda yang saya
 * pegang masuk sini juga tidak, lalu apa yang harus saya lakukan.
 */
function BarisKategori({
  kategori,
  as: As = "li",
}: {
  kategori: WasteCategory;
  as?: "li" | "div";
}) {
  return (
    <Kartu
      as={As}
      id={`jenis-${kategori.key}`}
      className="flex scroll-mt-4 items-stretch overflow-hidden"
    >
      <span
        aria-hidden
        className="w-1.5 shrink-0"
        style={{ background: WASTE_COLOR[kategori.key] }}
      />
      <div className="min-w-0 flex-1 p-3">
        <p className="text-[15px] font-semibold">{kategori.name}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
          {kategori.description}.
        </p>
        <p className="mt-1.5 text-[14px] leading-snug">
          Termasuk {gabung(contohBenda(kategori.key))}.
        </p>
        <p className="mt-2.5 border-t border-line pt-2.5 text-[13px] leading-snug text-ink-2">
          {kategori.handlingTip}
        </p>
      </div>
    </Kartu>
  );
}
