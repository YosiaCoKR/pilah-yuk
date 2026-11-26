"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GALAT_JARINGAN,
  normalkanHp,
  periksaMasuk,
  type IsiMasuk,
} from "@/lib/akun";
import { kirim as kirimApi } from "@/lib/kirim";
import { Isian, KotakGalat } from "../primitif";
import { Tombol } from "../tombol";

const KOSONG: IsiMasuk = { hp: "", sandi: "" };

export function FormMasuk() {
  const id = useId();
  const [isi, setIsi] = useState<IsiMasuk>(KOSONG);
  const router = useRouter();
  const [galatForm, setGalatForm] = useState<string | null>(null);
  /* Sama seperti form daftar: validasi menunggu tombol ditekan supaya warga
     tidak ditegur di huruf pertama. */
  const [dicoba, setDicoba] = useState(false);
  const galat = dicoba ? periksaMasuk(isi) : {};

  const ubah = (k: keyof IsiMasuk) => (v: string) => {
    setIsi((x) => ({ ...x, [k]: v }));
    setGalatForm(null);
  };

  const [mengirim, setMengirim] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const g = periksaMasuk(isi);
    if (Object.keys(g).length) {
      document.getElementById(`${id}-${Object.keys(g)[0]}`)?.focus();
      return;
    }
    if (!navigator.onLine) return setGalatForm(GALAT_JARINGAN);
    setMengirim(true);
    /* Server menjawab satu pesan gabungan untuk nomor ATAU sandi salah, dan
       memasang cookie sesi kalau cocok (src/lib/api.ts). */
    const h = await kirimApi("POST", "/api/akun/masuk", {
      hp: normalkanHp(isi.hp),
      sandi: isi.sandi,
    });
    setMengirim(false);
    if (!h.ok) return setGalatForm(h.pesan);
    /* Langsung ke beranda — tidak ada kartu "berhasil" yang harus ditutup
       dulu. `replace` supaya tombol kembali tidak membuka layar masuk lagi. */
    router.replace("/");
  }

  return (
    <form className="space-y-4 px-4 pb-10 pt-5" onSubmit={kirim} noValidate>
      <KotakGalat>{galatForm}</KotakGalat>
      <Isian
        id={`${id}-hp`}
        label="Nomor HP"
        bantuan="Nomor yang sama seperti waktu mendaftar."
        value={isi.hp}
        onChange={ubah("hp")}
        placeholder="0812 3456 7890"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        galat={galat.hp}
      />

      <Isian
        id={`${id}-sandi`}
        label="Kata sandi"
        bantuan="Minimal 8 karakter."
        value={isi.sandi}
        onChange={ubah("sandi")}
        placeholder="••••••••"
        type="password"
        autoComplete="current-password"
        galat={galat.sandi}
      />
      <p className="-mt-2 text-right text-[13px]">
        <Link href="/lupa-sandi" className="font-semibold text-ink underline">
          Lupa kata sandi?
        </Link>
      </p>

      <Tombol type="submit" lebar className="mt-1" disabled={mengirim}>
        {mengirim ? "Memeriksa…" : "Masuk"}
      </Tombol>

      <p className="text-center text-[13px] text-ink-2">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-ink underline">
          Daftar
        </Link>{" "}
        dulu, cuma tiga isian.
      </p>
    </form>
  );
}
