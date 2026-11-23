import { FormLupaSandi } from "@/components/akun/form-lupa-sandi";
import { Kop } from "@/components/kop";

export const metadata = { title: "Lupa kata sandi — Pilah Yuk" };

export default function LupaSandiPage() {
  return (
    <>
      <Kop
        judul="Lupa kata sandi"
        keterangan="Atur ulang pakai kode SMS"
        kembali="/masuk"
      />
      <main>
        <FormLupaSandi />
      </main>
    </>
  );
}
