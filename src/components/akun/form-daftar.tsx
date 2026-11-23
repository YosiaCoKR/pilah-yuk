"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { periksaPendaftaran, type IsiDaftar, type Peran } from "@/lib/akun";
import { HP_TERDAFTAR } from "@/lib/mock";
import { Isian, Kartu } from "../primitif";
import { Tombol, TombolLink } from "../tombol";
import { IkonCentang } from "../ikon";

/* Mayoritas pendaftar warga biasa, jadi itu bawaannya — pengurus cukup
   sekali ketuk untuk menggantinya. */
const KOSONG: IsiDaftar = { nama: "", hp: "", sandi: "", peran: "warga" };

const PERAN: { nilai: Peran; judul: string; ket: string }[] = [
  {
    nilai: "warga",
    judul: "Warga rumah tangga",
    ket: "Pesan jemput, atur jadwal rutin, bayar langganan.",
  },
  {
    nilai: "pengurus",
    judul: "Pengurus RT/RW",
    ket: "Kelola channel, umumkan jadwal angkut, atur anggota.",
  },
];

export function FormDaftar() {
  const id = useId();
  const [isi, setIsi] = useState<IsiDaftar>(KOSONG);
  const [akun, setAkun] = useState<Pick<IsiDaftar, "nama" | "peran"> | null>(
    null,
  );
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
    setAkun({ nama: isi.nama.trim(), peran: isi.peran });
  }

  if (akun) return <Selesai {...akun} />;

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

      <fieldset className="space-y-1.5">
        <legend className="text-[14px] font-semibold">Daftar sebagai</legend>
        <p className="text-[13px] leading-snug text-ink-2">
          Pengurus tetap bisa memesan jemput untuk rumahnya sendiri.
        </p>
        <div className="grid gap-2 pt-0.5">
          {PERAN.map((p) => (
            <label
              key={p.nilai}
              className="flex cursor-pointer items-start gap-3 rounded-kartu border border-line bg-card p-3 has-[:checked]:border-hijau has-[:checked]:bg-hijau-tipis has-[:focus-visible]:outline-2"
            >
              <input
                type="radio"
                name={`${id}-peran`}
                value={p.nilai}
                checked={isi.peran === p.nilai}
                onChange={() => setIsi((x) => ({ ...x, peran: p.nilai }))}
                className="mt-1 size-4 accent-hijau"
              />
              <span>
                <span className="block text-[15px] font-semibold">
                  {p.judul}
                </span>
                <span className="block text-[13px] leading-snug text-ink-2">
                  {p.ket}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Tombol type="submit" lebar className="mt-1">
        Daftar
      </Tombol>

      <p className="text-center text-[13px] text-ink-2">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-semibold text-ink underline">
          Masuk
        </Link>{" "}
        pakai nomor yang sama.
      </p>
    </form>
  );
}

function Selesai({ nama, peran }: Pick<IsiDaftar, "nama" | "peran">) {
  const pengurus = peran === "pengurus";
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
          {pengurus
            ? "Buka channel RT/RW-mu untuk mengumumkan jadwal angkut dan menyetujui warga yang ingin bergabung."
            : "Sekarang pesan jemput pertamamu, atau gabung dulu ke channel RT/RW sesuai alamat rumah."}
        </p>
        <div className="mt-5 space-y-2">
          <TombolLink href={pengurus ? "/channel" : "/pesan"} lebar>
            {pengurus ? "Buka channel" : "Pesan jemput"}
          </TombolLink>
          <TombolLink href="/" varian="garis" lebar>
            Ke halaman utama
          </TombolLink>
        </div>
      </Kartu>
    </div>
  );
}
