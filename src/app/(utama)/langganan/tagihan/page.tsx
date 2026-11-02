import { Kop } from "@/components/kop";
import { DaftarTagihan } from "@/components/langganan/daftar-tagihan";
import { Kartu, Label } from "@/components/primitif";
import { TAGIHAN } from "@/lib/mock";
import { rupiah } from "@/lib/tanggal";

export const metadata = { title: "Riwayat pembayaran — Pilah Yuk" };

export default function TagihanPage() {
  /* Yang benar-benar masuk, bukan seluruh tagihan: percobaan yang gagal tidak
     pernah menjadi uang. */
  const lunas = TAGIHAN.filter((t) => t.status === "lunas");
  const total = lunas.reduce((n, t) => n + t.amount, 0);

  return (
    <>
      <Kop
        judul="Riwayat pembayaran"
        keterangan={`${lunas.length} pembayaran berhasil`}
        kembali="/langganan/status"
      />
      <main className="space-y-7 pb-10 pt-5">
        <Kartu className="p-4">
          <p className="text-[13px] font-semibold text-ink-2">
            Total dibayar
          </p>
          <p className="angka mt-1 text-[30px] font-extrabold leading-none">
            {rupiah(total)}
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-ink-2">
            Dari {lunas.length} pembayaran langganan. Iuran jemput tambahan di
            luar paket tidak dihitung di sini.
          </p>
        </Kartu>

        <section className="space-y-3">
          <Label>Semua tagihan</Label>
          <DaftarTagihan tagihan={TAGIHAN} />
        </section>
      </main>
    </>
  );
}
