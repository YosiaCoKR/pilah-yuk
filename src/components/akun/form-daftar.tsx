"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  GALAT_JARINGAN,
  normalkanHp,
  periksaKode,
  periksaPendaftaran,
  type IsiDaftar,
  type Peran,
} from "@/lib/akun";
import { kirim as kirimApi } from "@/lib/kirim";
import { Isian, Kartu, KotakGalat } from "../primitif";
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
  const [galatForm, setGalatForm] = useState<string | null>(null);
  /* Akun baru aktif setelah kode SMS cocok — membuktikan nomornya memang
     milik pendaftar, bukan nomor tetangga yang nanti kebanjiran pengingat. */
  const [tungguKode, setTungguKode] = useState(false);
  /* Nomor terdaftar diperiksa server (409), bukan daftar di perangkat. */
  const galat = dicoba ? periksaPendaftaran(isi, []) : {};
  const [mengirim, setMengirim] = useState(false);

  const ubah = (k: keyof IsiDaftar) => (v: string) => {
    setIsi((x) => ({ ...x, [k]: v }));
    setGalatForm(null);
  };

  const badan = () => ({
    ...isi,
    nama: isi.nama.trim(),
    hp: normalkanHp(isi.hp),
  });

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const g = periksaPendaftaran(isi, []);
    if (Object.keys(g).length) {
      document.getElementById(`${id}-${Object.keys(g)[0]}`)?.focus();
      return;
    }
    if (!navigator.onLine) return setGalatForm(GALAT_JARINGAN);
    setMengirim(true);
    const h = await kirimApi("POST", "/api/akun/daftar", badan());
    setMengirim(false);
    if (!h.ok) return setGalatForm(Object.values(h.rincian)[0] ?? h.pesan);
    setTungguKode(true);
  }

  if (akun) return <Selesai {...akun} />;
  if (tungguKode)
    return (
      <LangkahKode
        hp={normalkanHp(isi.hp)}
        /* Langkah kode mengirim ULANG nama, sandi, dan peran bersama kodenya:
           server baru memasang sandi setelah nomornya terbukti. */
        verifikasi={async (kode) => {
          const h = await kirimApi("POST", "/api/akun/daftar/verifikasi", {
            ...badan(),
            kode,
          });
          if (!h.ok) return h.rincian.kode ?? h.pesan;
          setAkun({ nama: isi.nama.trim(), peran: isi.peran });
          return null;
        }}
        onUlang={() => setTungguKode(false)}
      />
    );

  return (
    <form className="space-y-4 px-4 pb-10 pt-5" onSubmit={kirim} noValidate>
      <KotakGalat>{galatForm}</KotakGalat>
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

      <Tombol type="submit" lebar className="mt-1" disabled={mengirim}>
        {mengirim ? "Mengirim kode…" : "Daftar"}
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

function LangkahKode({
  hp,
  verifikasi,
  onUlang,
}: {
  hp: string;
  /** `null` = cocok; selain itu pesan galat untuk ditampilkan. */
  verifikasi: (kode: string) => Promise<string | null>;
  onUlang: () => void;
}) {
  const id = useId();
  const [kode, setKode] = useState("");
  const [dicoba, setDicoba] = useState(false);
  const [galatForm, setGalatForm] = useState<string | null>(null);
  const galat = dicoba ? periksaKode(kode) : undefined;
  const [mengirim, setMengirim] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    if (periksaKode(kode)) {
      document.getElementById(`${id}-kode`)?.focus();
      return;
    }
    if (!navigator.onLine) return setGalatForm(GALAT_JARINGAN);
    setMengirim(true);
    const galat = await verifikasi(kode.replace(/\s/g, ""));
    setMengirim(false);
    if (galat) setGalatForm(galat);
  }

  return (
    <form className="space-y-4 px-4 pb-10 pt-5" onSubmit={kirim} noValidate>
      <KotakGalat>{galatForm}</KotakGalat>
      <p
        aria-live="polite"
        className="rounded-kartu border border-line bg-card p-3 text-[13px] leading-snug text-ink-2"
      >
        Kode 6 angka sudah dikirim lewat SMS ke{" "}
        <span className="font-semibold text-ink">{hp}</span>. Biasanya sampai
        dalam satu menit.
      </p>

      <Isian
        id={`${id}-kode`}
        label="Kode dari SMS"
        bantuan="Akunmu aktif begitu kodenya cocok."
        value={kode}
        onChange={(v) => {
          setKode(v);
          setGalatForm(null);
        }}
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        galat={galat}
      />

      <Tombol type="submit" lebar className="mt-1" disabled={mengirim}>
        {mengirim ? "Memeriksa…" : "Aktifkan akun"}
      </Tombol>

      <p className="text-center text-[13px] text-ink-2">
        Kode tidak datang?{" "}
        <button
          type="button"
          onClick={onUlang}
          className="font-semibold text-ink underline"
        >
          Kirim ulang atau ganti nomor
        </button>
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
