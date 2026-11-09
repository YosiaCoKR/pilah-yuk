"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { periksaMasuk, type IsiMasuk } from "@/lib/akun";
import { HP_TERDAFTAR } from "@/lib/mock";
import { Isian, Kartu } from "../primitif";
import { Tombol, TombolLink } from "../tombol";
import { IkonCentang } from "../ikon";

const KOSONG: IsiMasuk = { hp: "", sandi: "" };

export function FormMasuk() {
  const id = useId();
  const [isi, setIsi] = useState<IsiMasuk>(KOSONG);
  const [masuk, setMasuk] = useState(false);
  /* Sama seperti form daftar: validasi menunggu tombol ditekan supaya warga
     tidak ditegur di huruf pertama. */
  const [dicoba, setDicoba] = useState(false);
  const galat = dicoba ? periksaMasuk(isi, HP_TERDAFTAR) : {};

  const ubah = (k: keyof IsiMasuk) => (v: string) =>
    setIsi((x) => ({ ...x, [k]: v }));

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const g = periksaMasuk(isi, HP_TERDAFTAR);
    if (Object.keys(g).length) {
      document.getElementById(`${id}-${Object.keys(g)[0]}`)?.focus();
      return;
    }
    /* ponytail: sesi cuma hidup di state layar ini. Ganti dengan panggilan
       masuk sungguhan saat task backend Fase 4 dikerjakan. */
    setMasuk(true);
  }

  if (masuk) return <Selesai />;

  return (
    <form className="space-y-4 px-4 pb-10 pt-5" onSubmit={kirim} noValidate>
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

      <Tombol type="submit" lebar className="mt-1">
        Masuk
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

function Selesai() {
  return (
    <div className="px-4 pb-10 pt-8">
      <Kartu className="p-6 text-center motion-safe:animate-[terbit_.45s_cubic-bezier(.2,.8,.2,1)_both]">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-hijau text-white">
          <IkonCentang className="size-7" />
        </span>
        <h2 className="mt-4 text-[20px] font-bold leading-tight">
          Selamat datang kembali
        </h2>
        <p className="mx-auto mt-1 max-w-[30ch] text-[14px] leading-snug text-ink-2">
          Jadwal jemput dan tagihan langgananmu sudah menunggu di halaman
          utama.
        </p>
        <div className="mt-5 space-y-2">
          <TombolLink href="/" lebar>
            Ke halaman utama
          </TombolLink>
          <TombolLink href="/pesan" varian="garis" lebar>
            Pesan jemput
          </TombolLink>
        </div>
      </Kartu>
    </div>
  );
}
