"use client";

import { useId, useState } from "react";
import { periksaPendaftaran, type IsiDaftar } from "@/lib/akun";
import { HP_TERDAFTAR } from "@/lib/mock";
import { Isian, Kartu } from "../primitif";
import { Tombol, TombolLink } from "../tombol";
import { IkonCentang } from "../ikon";

const KOSONG: IsiDaftar = { nama: "", hp: "", sandi: "" };

export function FormDaftar() {
  const id = useId();
  const [isi, setIsi] = useState<IsiDaftar>(KOSONG);
  const [nama, setNama] = useState<string | null>(null);
  /* Validasi baru muncul setelah tombol ditekan — warga jangan ditegur saat
     masih mengetik huruf pertama. */
  const [dicoba, setDicoba] = useState(false);
  const galat = dicoba ? periksaPendaftaran(isi, HP_TERDAFTAR) : {};

  const ubah = (k: keyof IsiDaftar) => (v: string) =>
    setIsi((x) => ({ ...x, [k]: v }));

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const g = periksaPendaftaran(isi, HP_TERDAFTAR);
    if (Object.keys(g).length) {
      document.getElementById(`${id}-${Object.keys(g)[0]}`)?.focus();
      return;
    }
    /* ponytail: akun cuma disimpan di state layar ini. Ganti dengan panggilan
       pendaftaran sungguhan saat task backend Fase 4 dikerjakan. */
    setNama(isi.nama.trim());
  }

  if (nama) return <Selesai nama={nama} />;

  return (
    <form className="space-y-4 px-4 pb-10 pt-5" onSubmit={kirim} noValidate>
      <Isian
        id={`${id}-nama`}
        label="Nama"
        bantuan="Nama panggilan saja cukup."
        value={isi.nama}
        onChange={ubah("nama")}
        placeholder="Siti Rahma"
        autoComplete="name"
        galat={galat.nama}
      />

      <Isian
        id={`${id}-hp`}
        label="Nomor HP"
        bantuan="Dipakai untuk pengingat sebelum petugas datang."
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
        autoComplete="new-password"
        galat={galat.sandi}
      />

      <Tombol type="submit" lebar className="mt-1">
        Daftar
      </Tombol>

      <p className="text-center text-[13px] text-ink-2">
        Sudah punya akun?{" "}
        <span className="font-semibold text-ink">Masuk</span> pakai nomor yang
        sama.
      </p>
    </form>
  );
}

function Selesai({ nama }: { nama: string }) {
  return (
    <div className="px-4 pb-10 pt-8">
      <Kartu className="p-6 text-center motion-safe:animate-[terbit_.45s_cubic-bezier(.2,.8,.2,1)_both]">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-hijau text-white">
          <IkonCentang className="size-7" />
        </span>
        <h2 className="mt-4 text-[20px] font-bold leading-tight">
          Akun siap, {nama}
        </h2>
        <p className="mx-auto mt-1 max-w-[30ch] text-[14px] leading-snug text-ink-2">
          Sekarang pesan jemput pertamamu, atau gabung dulu ke channel RT/RW
          sesuai alamat rumah.
        </p>
        <div className="mt-5 space-y-2">
          <TombolLink href="/pesan" lebar>
            Pesan jemput
          </TombolLink>
          <TombolLink href="/" varian="garis" lebar>
            Ke halaman utama
          </TombolLink>
        </div>
      </Kartu>
    </div>
  );
}
