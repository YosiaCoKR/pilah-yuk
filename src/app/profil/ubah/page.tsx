import { Kop } from "@/components/kop";
import { FormAkun } from "@/components/profil/form-akun";

export const metadata = { title: "Ubah profil — Pilah Yuk" };

export default function UbahProfilPage() {
  return (
    <>
      <Kop judul="Ubah profil" keterangan="Nama dan kontak" kembali="/profil" />
      <FormAkun />
    </>
  );
}
