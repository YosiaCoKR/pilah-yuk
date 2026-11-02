import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AksiBerkas } from "@/components/aksi-berkas";
import { Kop } from "@/components/kop";
import { Kartu, Label, Perforasi } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { teksKuitansi } from "@/lib/kalimat";
import { invoiceById } from "@/lib/mock";
import { rupiah, tanggalPendek, tanggalPenuh } from "@/lib/tanggal";

export const metadata = { title: "Detail pembayaran — Pilah Yuk" };

export default function DetailTagihanPage(
  props: PageProps<"/langganan/tagihan/[id]">,
) {
  return (
    <>
      <Kop judul="Detail pembayaran" kembali="/langganan/tagihan" />
      <Suspense fallback={<Kerangka />}>
        <Isi params={props.params} />
      </Suspense>
    </>
  );
}

function Kerangka() {
  return (
    <div className="space-y-6 pb-10 pt-5">
      <Kartu className="h-64 animate-pulse" />
      <Kartu className="h-28 animate-pulse" />
    </div>
  );
}

async function Isi({
  params,
}: {
  params: PageProps<"/langganan/tagihan/[id]">["params"];
}) {
  const { id } = await params;
  const tagihan = invoiceById(id);
  if (!tagihan) notFound();

  const gagal = tagihan.status === "gagal";

  return (
    <main className="space-y-7 pb-10 pt-5">
      {/* Struk pembayaran. Di sini uang memang pokok perkaranya, jadi
          jumlahnya yang besar — beda dari layar langganan, yang menjawab
          "berapa jemput lagi punya saya". */}
      <Kartu className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-2">
              {gagal ? "Gagal ditagih" : "Jumlah dibayar"}
            </p>
            <p
              className={`angka mt-1 text-[38px] font-extrabold leading-none ${
                gagal ? "text-ink-3 line-through" : ""
              }`}
            >
              {rupiah(tagihan.amount)}
            </p>
            <p className="angka mt-1.5 text-[14px] font-bold text-ink-2">
              {tagihan.code}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-kartu border px-2.5 py-1 text-[12px] font-semibold ${
              gagal
                ? "border-alarm/45 bg-alarm-tipis text-alarm"
                : "border-hijau/45 bg-hijau-tipis text-hijau"
            }`}
          >
            {gagal ? "Gagal" : "Lunas"}
          </span>
        </div>

        <div className="py-1">
          <Perforasi />
        </div>

        <dl className="space-y-3 p-4 pt-3 text-[14px]">
          <Baris istilah="Paket">
            <span className="font-semibold">{tagihan.planName}</span>
          </Baris>

          {/* Yang dicari warga di halaman ini biasanya ini: uang segini
              menutup sampai tanggal berapa. */}
          <Baris istilah="Masa langganan">
            <span className="font-semibold">
              {tanggalPendek(tagihan.periodStart)} –{" "}
              {tanggalPendek(tagihan.periodEnd)}
            </span>
          </Baris>

          <Baris istilah="Cara bayar">{tagihan.method}</Baris>

          <Baris istilah={gagal ? "Tanggal percobaan" : "Tanggal bayar"}>
            {tanggalPenuh(tagihan.paidAt)}
          </Baris>
        </dl>
      </Kartu>

      {gagal && (
        <Kartu className="p-4">
          <p className="text-[14px] font-semibold leading-snug text-alarm">
            {tagihan.failureReason}
          </p>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">
            Tidak ada uang yang terpotong. Kalau saldomu berkurang, bawa kode{" "}
            <span className="angka font-semibold text-ink">{tagihan.code}</span>{" "}
            ke pengurus RW.
          </p>
          <div className="mt-4">
            <TombolLink lebar varian="garis" href="/langganan">
              Bayar lagi
            </TombolLink>
          </div>
        </Kartu>
      )}

      <section className="space-y-3">
        <Label>Kuitansi</Label>
        <Kartu className="p-4">
          {/* Kuitansi percobaan yang gagal tetap berguna — justru itu yang
              dibawa warga saat uangnya terpotong tapi langganannya tidak
              jalan, jadi isinya disebut apa adanya untuk keadaan itu. */}
          <p className="text-[14px] leading-snug text-ink-2">
            {gagal
              ? "Berisi kode, sebab gagalnya, dan jumlah yang coba ditagih. Kirim ke pengurus RW kalau saldomu terlanjur berkurang."
              : "Berisi kode, paket, masa langganan, dan jumlahnya. Simpan atau kirim ke pengurus RW kalau pembayaranmu perlu dicocokkan."}
          </p>
          <div className="mt-4">
            <AksiBerkas
              judul={`Kuitansi langganan ${tagihan.code}`}
              namaBerkas={`kuitansi-${tagihan.code}.txt`}
              teks={teksKuitansi(tagihan)}
            />
          </div>
        </Kartu>
      </section>
    </main>
  );
}

function Baris({
  istilah,
  children,
}: {
  istilah: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[13px] text-ink-2">{istilah}</dt>
      <dd className="text-right leading-snug">{children}</dd>
    </div>
  );
}
