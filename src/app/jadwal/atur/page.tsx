import { FormRutin } from "@/components/jadwal/form-rutin";
import { Kop } from "@/components/kop";
import { RECURRING } from "@/lib/mock";

export const metadata = { title: "Atur jadwal rutin — Pilah Yuk" };

export default function AturJadwalPage() {
  return (
    <>
      <Kop
        judul="Atur jadwal rutin"
        keterangan="Petugas datang tanpa perlu dipesan ulang"
        kembali="/jadwal"
      />
      <FormRutin awal={RECURRING} />
    </>
  );
}
