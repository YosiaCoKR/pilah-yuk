import { FormDaftar } from "@/components/akun/form-daftar";
import { Kop } from "@/components/kop";

export const metadata = { title: "Daftar akun — Pilah Yuk" };

export default function DaftarPage() {
  return (
    <>
      <Kop
        judul="Daftar akun"
        keterangan="Tiga isian, selesai dalam semenit"
        kembali="/"
      />
      <main>
        <FormDaftar />
      </main>
    </>
  );
}
