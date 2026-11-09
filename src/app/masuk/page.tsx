import { FormMasuk } from "@/components/akun/form-masuk";
import { Kop } from "@/components/kop";

export const metadata = { title: "Masuk — Pilah Yuk" };

export default function MasukPage() {
  return (
    <>
      <Kop
        judul="Masuk"
        keterangan="Nomor HP dan kata sandi, itu saja"
        kembali="/"
      />
      <main>
        <FormMasuk />
      </main>
    </>
  );
}
