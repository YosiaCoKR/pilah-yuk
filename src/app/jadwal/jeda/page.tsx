import { FormJeda } from "@/components/jadwal/form-jeda";

export const metadata = { title: "Jeda jadwal — Pilah Yuk" };

export default function JedaJadwalPage() {
  /* Judulnya ikut keadaan jadwal, jadi Kop dirender di dalam form. */
  return <FormJeda />;
}
