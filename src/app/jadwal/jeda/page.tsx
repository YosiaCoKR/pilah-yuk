import { redirect } from "next/navigation";
import { FormJeda } from "@/components/jadwal/form-jeda";
import { jadwalRutin, pesananMendatang } from "@/lib/data";

export const metadata = { title: "Jeda jadwal — Pilah Yuk" };

export default async function JedaJadwalPage() {
  const [jadwal, mendatang] = await Promise.all([
    jadwalRutin(),
    pesananMendatang(),
  ]);
  /* Belum ada yang bisa dijeda — arahkan ke membuatnya. */
  if (!jadwal) redirect("/jadwal/atur");
  /* Judulnya ikut keadaan jadwal, jadi Kop dirender di dalam form. */
  return <FormJeda jadwal={jadwal} mendatang={mendatang} />;
}
