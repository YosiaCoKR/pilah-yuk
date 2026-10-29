import { Suspense } from "react";
import { IkonCentang } from "@/components/ikon";
import { LiniStatus } from "@/components/lini-status";
import { ChipSampah, Kartu, Label, Perforasi } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { addressById, slotById } from "@/lib/mock";
import { hariPanjang, tanggalPendek } from "@/lib/tanggal";
import { StatusJemput } from "@/components/status-jemput";
import type { WasteKey } from "@/lib/types";

export const metadata = { title: "Permintaan terkirim — Pilah Yuk" };

const KODE = "PY-4833";

export default function TerkirimPage(props: PageProps<"/pesan/terkirim">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col px-4 py-8">
      {/* The one motion moment in the app: the stub arrives. */}
      <div className="mb-6 flex flex-col items-center text-center motion-safe:animate-[terbit_.45s_cubic-bezier(.2,.8,.2,1)_both]">
        <span className="grid size-14 place-items-center rounded-full bg-hijau text-white">
          <IkonCentang className="size-7" />
        </span>
        <h1 className="mt-4 text-[22px] font-bold leading-tight">
          Permintaan terkirim
        </h1>
        <p className="mt-1 max-w-[30ch] text-[14px] leading-snug text-ink-2">
          Petugas channel RW sudah menerima pesananmu. Statusnya menunggu
          sampai petugas berangkat.
        </p>
      </div>

      {/* The order detail comes from the URL, so it streams in after the
          shell. The fallback holds the ticket's height to avoid a jump. */}
      <Suspense fallback={<StrukKosong />}>
        <Struk cari={props.searchParams} />
      </Suspense>

      <section className="mt-7 space-y-3">
        <Label>Selanjutnya</Label>
        <Kartu className="p-4">
          <LiniStatus sekarang="menunggu" />
        </Kartu>
        <p className="text-[13px] leading-snug text-ink-3">
          Kami kirim pengingat lewat WhatsApp sehari sebelum jadwal. Selama
          statusnya masih menunggu, pesanan bisa diubah atau dibatalkan.
        </p>
      </section>

      <div className="mt-7 space-y-2">
        <TombolLink href="/" lebar>
          Selesai
        </TombolLink>
        <TombolLink href="/jadwal" varian="garis" lebar>
          Jadikan jadwal rutin
        </TombolLink>
      </div>
    </main>
  );
}

function StrukKosong() {
  return <Kartu className="h-56 animate-pulse" />;
}

async function Struk({
  cari,
}: {
  cari: PageProps<"/pesan/terkirim">["searchParams"];
}) {
  const q = await cari;
  const satu = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const alamat = addressById(satu(q.alamat));
  const slot = slotById(satu(q.slot));
  const tanggal = satu(q.tanggal);
  const jenis = (satu(q.jenis) ?? "").split(",").filter(Boolean) as WasteKey[];
  const catatan = satu(q.catatan);

  return (
    <Kartu className="overflow-hidden motion-safe:animate-[terbit_.45s_cubic-bezier(.2,.8,.2,1)_both]">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Kode pesanan</p>
          <p className="angka mt-0.5 text-[26px] font-extrabold leading-tight">
            {KODE}
          </p>
          <span className="mt-1.5 inline-block">
            <StatusJemput status="menunggu" />
          </span>
        </div>
        {tanggal && (
          <div className="text-right">
            <p className="angka text-[16px] font-bold leading-tight">
              {hariPanjang(tanggal)}
            </p>
            <p className="angka text-[14px] text-ink-2">
              {tanggalPendek(tanggal)} · {slot?.range}
            </p>
          </div>
        )}
      </div>

      <div className="py-1">
        <Perforasi />
      </div>

      <div className="space-y-3 p-4 pt-3">
        <div>
          <p className="text-[15px] font-semibold">{alamat?.label}</p>
          <p className="text-[13px] leading-snug text-ink-2">
            {alamat?.fullAddress}
          </p>
          {alamat?.landmark && (
            <p className="mt-0.5 text-[13px] text-ink-3">
              Patokan: {alamat.landmark}
            </p>
          )}
        </div>

        {jenis.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {jenis.map((k) => (
              <ChipSampah key={k} jenis={k} ukuran="sm" />
            ))}
          </div>
        )}

        {catatan && (
          <p className="rounded-kartu bg-paper p-2.5 text-[13px] leading-snug text-ink-2">
            “{catatan}”
          </p>
        )}
      </div>
    </Kartu>
  );
}
