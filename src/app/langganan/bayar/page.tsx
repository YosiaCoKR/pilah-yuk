import { Suspense } from "react";
import { FormBayar } from "@/components/langganan/form-bayar";
import { Kop } from "@/components/kop";
import { Kartu } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { PAKET } from "@/lib/mock";

export const metadata = { title: "Pembayaran — Pilah Yuk" };

export default function BayarPage(props: PageProps<"/langganan/bayar">) {
  return (
    <>
      <Kop
        judul="Pembayaran"
        keterangan="Pilih satu cara bayar"
        kembali="/langganan"
      />
      <Suspense fallback={<Kerangka />}>
        <Isi cari={props.searchParams} />
      </Suspense>
    </>
  );
}

function Kerangka() {
  return (
    <div className="space-y-3 px-4 pb-10 pt-5">
      <Kartu className="h-24 animate-pulse" />
      <Kartu className="h-64 animate-pulse" />
    </div>
  );
}

/* Paket dibaca dari URL, jadi tautan pembayaran bisa dibuka lagi dari kartu
   "Belum dibayar" tanpa menyimpan keadaan apa pun di antara dua halaman. */
async function Isi({
  cari,
}: {
  cari: PageProps<"/langganan/bayar">["searchParams"];
}) {
  const { paket: id } = await cari;
  const paket = PAKET.find((p) => p.id === id && p.isActive);

  if (!paket) {
    return (
      <main className="px-4 pb-10 pt-5">
        <Kartu className="p-6 text-center">
          <p className="text-[15px] font-semibold">Paketnya belum dipilih</p>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">
            Pembayaran butuh satu paket. Pilih dulu di halaman langganan, lalu
            lanjut ke sini.
          </p>
          <div className="mt-4">
            <TombolLink varian="garis" href="/langganan">
              Pilih paket
            </TombolLink>
          </div>
        </Kartu>
      </main>
    );
  }

  return (
    <main>
      <FormBayar paket={paket} />
    </main>
  );
}
