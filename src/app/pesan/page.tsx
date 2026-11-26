import { FormPesan } from "@/components/pesan/form-pesan";
import { Kop } from "@/components/kop";
import { alamatku, langgananku } from "@/lib/data";

export const metadata = { title: "Pesan jemput — Pilah Yuk" };

export default async function PesanPage() {
  const [alamat, langganan] = await Promise.all([alamatku(), langgananku()]);
  const utama = alamat.find((a) => a.isDefault);
  return (
    <main className="min-h-dvh">
      <Kop
        judul="Pesan jemput"
        keterangan={
          utama?.rwChannelName
            ? `Petugas ${utama.rwChannelName}`
            : "Petugas datang ke alamatmu"
        }
        kembali="/"
      />
      <div className="mx-auto max-w-screen-sm">
        <FormPesan alamat={alamat} langganan={langganan} />
      </div>
    </main>
  );
}
