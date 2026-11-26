import { Kop } from "@/components/kop";
import { FormAkun } from "@/components/profil/form-akun";
import { akunku } from "@/lib/data";

export const metadata = { title: "Ubah profil — Pilah Yuk" };

export default async function UbahProfilPage() {
  const akun = await akunku();
  return (
    <>
      <Kop
        judul="Ubah profil"
        keterangan="Nama yang dipanggil petugas"
        kembali="/profil"
      />
      <FormAkun akun={akun} />
    </>
  );
}
