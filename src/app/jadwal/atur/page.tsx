import { connection } from "next/server";
import { FormRutin } from "@/components/jadwal/form-rutin";
import { Kop } from "@/components/kop";
import { alamatku, jadwalRutin, langgananku, slotWaktu } from "@/lib/data";

export const metadata = { title: "Atur jadwal rutin — Pilah Yuk" };

export default async function AturJadwalPage() {
  /* Tanggal hari ini dibaca per request, bukan saat prerender. */
  await connection();
  const [awal, alamat, slot, langganan] = await Promise.all([
    jadwalRutin(),
    alamatku(),
    /* Jadwal rutin tidak terikat satu tanggal: daftar jam dibaca untuk hari
       ini saja, tanpa tanda penuh — penuhnya berubah tiap tanggal. */
    slotWaktu(new Date().toISOString().slice(0, 10)).then((xs) =>
      xs.map((s) => ({ ...s, full: false })),
    ),
    langgananku(),
  ]);
  return (
    <>
      <Kop
        judul="Atur jadwal rutin"
        keterangan="Petugas datang tanpa perlu dipesan ulang"
        kembali="/jadwal"
      />
      <FormRutin
        awal={awal}
        alamat={alamat}
        slot={slot}
        langganan={langganan}
      />
    </>
  );
}
