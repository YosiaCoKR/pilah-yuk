import { FormPesan } from "@/components/pesan/form-pesan";
import { Kop } from "@/components/kop";

export const metadata = { title: "Pesan jemput — Pilah Yuk" };

export default function PesanPage() {
  return (
    <main className="min-h-dvh">
      <Kop
        judul="Pesan jemput"
        keterangan="Petugas RW 05 Sukamaju"
        kembali="/"
      />
      <div className="mx-auto max-w-screen-sm">
        <FormPesan />
      </div>
    </main>
  );
}
