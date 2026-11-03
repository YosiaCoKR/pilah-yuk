import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Kop } from "@/components/kop";
import { ChipSampah, Kartu, Label } from "@/components/primitif";
import { gabung } from "@/lib/kalimat";
import {
  WASTE_CATEGORIES,
  WASTE_COLOR,
  bendaJenis,
  categoryByKey,
  seringTertukar,
} from "@/lib/mock";
import type { WasteKey } from "@/lib/types";

/* Empat jenis, tetap. Dipranyalakan semuanya supaya halaman ini terbuka
   seketika saat warga sudah berdiri di depan tong. */
export const generateStaticParams = () =>
  WASTE_CATEGORIES.map((k) => ({ jenis: k.key }));

const adalahJenis = (s: string): s is WasteKey =>
  WASTE_CATEGORIES.some((k) => k.key === s);

export async function generateMetadata({
  params,
}: PageProps<"/panduan/[jenis]">) {
  const { jenis } = await params;
  if (!adalahJenis(jenis)) return { title: "Panduan pilah — Pilah Yuk" };
  return { title: `${categoryByKey(jenis).name} — Panduan pilah` };
}

export default function DetailJenisPage(props: PageProps<"/panduan/[jenis]">) {
  return (
    <>
      <Kop judul="Jenis sampah" kembali="/panduan" />
      <Suspense fallback={<Kerangka />}>
        <Isi params={props.params} />
      </Suspense>
    </>
  );
}

/**
 * Kerangka muat yang bentuknya mengikuti halaman jadinya: kartu identitas,
 * lalu dua blok daftar. Kerangka yang ukurannya ngawur justru membuat isinya
 * melompat saat datang — yang paling terasa di layar HP yang sempit.
 */
function Kerangka() {
  return (
    <div className="space-y-7 pb-10 pt-5">
      <Kartu className="h-36 animate-pulse" />
      <div className="space-y-3">
        <span className="block h-4 w-32 animate-pulse rounded-kartu bg-line" />
        <Kartu className="h-16 animate-pulse" />
      </div>
      <div className="space-y-3">
        <span className="block h-4 w-44 animate-pulse rounded-kartu bg-line" />
        <Kartu className="h-20 animate-pulse" />
      </div>
    </div>
  );
}

async function Isi({
  params,
}: {
  params: PageProps<"/panduan/[jenis]">["params"];
}) {
  const { jenis } = await params;
  if (!adalahJenis(jenis)) notFound();

  const kategori = categoryByKey(jenis);
  const benda = bendaJenis(jenis);
  /* Catatan hanya ada di benda yang jawabannya bikin kaget, jadi ia sekaligus
     memisahkan "tinggal masukkan" dari "ada syaratnya". */
  const langsung = benda.filter((b) => !b.catatan);
  const bersyarat = benda.filter((b) => b.catatan);
  const tertukar = seringTertukar(jenis);

  return (
    <main className="space-y-7 pb-10 pt-5">
      {/* Warnanya dibuat selebar kartu, bukan pita tipis seperti di daftar:
          di halaman satu jenis, warna tong itulah identitas halamannya. */}
      <Kartu className="overflow-hidden">
        <span
          aria-hidden
          className="block h-2"
          style={{ background: WASTE_COLOR[jenis] }}
        />
        <div className="space-y-2 p-4">
          <h2 className="text-[22px] font-bold leading-tight">
            {kategori.name}
          </h2>
          <p className="text-[14px] leading-snug text-ink-2">
            {kategori.description}.
          </p>
          <p className="border-t border-line pt-2.5 text-[14px] leading-snug">
            {kategori.handlingTip}
          </p>
        </div>
      </Kartu>

      {langsung.length > 0 && (
        <section className="space-y-3">
          <Label>Tinggal masukkan</Label>
          {/* Dibaca sekali lirik sambil memegang bendanya, jadi dirangkai
              mengalir sebagai satu kalimat — sama seperti kartu di daftar
              jenis, dan tanpa benda yang perlu penjelasan ikut di dalamnya. */}
          <Kartu className="p-3">
            <p className="text-[15px] leading-relaxed">
              {gabung(langsung.map((b) => b.nama))}.
            </p>
          </Kartu>
        </section>
      )}

      {bersyarat.length > 0 && (
        <section className="space-y-3">
          <Label>Masuk, tapi ada syaratnya</Label>
          <ul className="space-y-2">
            {bersyarat.map((b) => (
              <Kartu as="li" key={b.nama} className="p-3">
                <p className="text-[15px] font-semibold">{b.nama}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
                  {b.catatan}
                </p>
              </Kartu>
            ))}
          </ul>
        </section>
      )}

      {tertukar.length > 0 && (
        <section className="space-y-3">
          <Label>Sering dikira {kategori.name.toLowerCase()}</Label>
          <ul className="space-y-2">
            {tertukar.map((b) => (
              <li key={b.nama}>
                {/* Ke halaman tong yang benar: warga yang sampai di sini
                    sedang memegang bendanya, jadi yang dibutuhkan jawaban
                    tujuannya, bukan sekadar koreksi. */}
                <Link
                  href={`/panduan/${b.jenis}`}
                  className="block rounded-kartu border border-line bg-card p-3 hover:border-line-kuat"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[15px] font-semibold">{b.nama}</p>
                    <ChipSampah jenis={b.jenis} ukuran="sm" />
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-ink-2">
                    {b.catatan}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <Label>Jenis lain</Label>
        <ul className="flex flex-wrap gap-2">
          {WASTE_CATEGORIES.filter((k) => k.key !== jenis).map((k) => (
            <li key={k.key}>
              <Link
                href={`/panduan/${k.key}`}
                className="flex min-h-11 items-center gap-2 rounded-kartu border border-line bg-card px-3 text-[14px] font-semibold hover:border-line-kuat"
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: WASTE_COLOR[k.key] }}
                />
                {k.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
