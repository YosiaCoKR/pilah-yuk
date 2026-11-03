import Link from "next/link";
import { IkonLanjut } from "@/components/ikon";
import { CariBenda } from "@/components/panduan/cari-benda";
import { TipsHarian } from "@/components/panduan/tips-harian";
import { Kartu, Label } from "@/components/primitif";
import { gabung } from "@/lib/kalimat";
import {
  WASTE_CATEGORIES,
  WASTE_COLOR,
  bendaJenis,
  contohBenda,
} from "@/lib/mock";
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

      {/* Di bawah kotak cari, bukan di atasnya: yang datang sambil memegang
          satu benda punya pertanyaan yang lebih mendesak daripada tips. */}
      <TipsHarian />

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
 *
 * Daftar lengkapnya dilipat ke dalam `<details>`, bukan komponen buka-tutup
 * sendiri: empat kartu yang terbuka sekaligus membuat halaman ini jadi daftar
 * bacaan, bukan jawaban. Elemen bawaan peramban sudah membawa keyboard,
 * pembaca layar, dan cari-dalam-halaman — dan tetap bisa dibuka sebelum
 * JavaScript-nya sampai.
 */
function BarisKategori({
  kategori,
  as: As = "li",
}: {
  kategori: WasteCategory;
  as?: "li" | "div";
}) {
  const contoh = contohBenda(kategori.key);
  /* Yang tersisa setelah contoh di ringkasan — mengulang contoh di daftar
     bawah membuat kartunya terbaca seperti salah cetak. */
  const sisa = bendaJenis(kategori.key).filter(
    (b) => !contoh.includes(b.nama),
  );

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

        <details className="group mt-1">
          {/* py-2 bukan baris teks telanjang: ini satu-satunya cara membuka
              daftarnya, jadi tingginya harus cukup untuk jempol — sejajar
              dengan min-h-11 yang dipakai tombol di aplikasi ini. */}
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-kartu py-2 text-[14px] leading-snug [&::-webkit-details-marker]:hidden">
            {/* Sisanya ikut masuk satu deret, bukan ditempel di belakang:
                "… & tulang ayam & 4 lainnya" punya dua "&" berderet. */}
            <span className="min-w-0 flex-1">
              Termasuk{" "}
              {gabung(
                sisa.length > 0
                  ? [...contoh, `${sisa.length} lainnya`]
                  : contoh,
              )}
              .
            </span>
            {/* Berputar menjawab ketukan — gerak yang menunjukkan apa yang
                berubah, dan dimatikan kalau perangkatnya meminta sedikit
                gerak. */}
            <IkonLanjut
              aria-hidden
              className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
          </summary>

          {sisa.length > 0 && (
            <ul className="mt-2 space-y-1.5 border-l border-line pl-3">
              {sisa.map((benda) => (
                <li key={benda.nama} className="text-[14px] leading-snug">
                  {benda.nama}
                  {/* Catatan hanya ada di benda yang jawabannya bikin kaget —
                      justru itu yang dicari warga saat membuka daftar ini. */}
                  {benda.catatan && (
                    <span className="block text-[13px] text-ink-2">
                      {benda.catatan}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Tautannya di dalam bagian yang terbuka: yang sudah membuka satu
              jenis memang sedang mendalaminya. Di keadaan tertutup, kartunya
              tetap cuma menjawab "masuk mana". */}
          <Link
            href={`/panduan/${kategori.key}`}
            className="mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-hijau"
          >
            Panduan lengkap {kategori.name.toLowerCase()}
          </Link>
        </details>

        <p className="mt-2.5 border-t border-line pt-2.5 text-[13px] leading-snug text-ink-2">
          {kategori.handlingTip}
        </p>
      </div>
    </Kartu>
  );
}
