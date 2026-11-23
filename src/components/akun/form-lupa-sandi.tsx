"use client";

import { useId, useState } from "react";
import {
  GALAT_JARINGAN,
  normalkanHp,
  periksaAturUlang,
  periksaLupa,
  type IsiAturUlang,
} from "@/lib/akun";
import { Isian, Kartu, KotakGalat } from "../primitif";
import { Tombol, TombolLink } from "../tombol";
import { IkonCentang } from "../ikon";

const KOSONG: IsiAturUlang = { kode: "", sandi: "", ulang: "" };

/**
 * Dua langkah di satu halaman: nomor HP → kode SMS + sandi baru. Nomor dari
 * langkah 1 tidak perlu dibawa lewat URL, jadi tidak ada halaman kedua.
 */
export function FormLupaSandi() {
  const id = useId();
  const [hp, setHp] = useState("");
  const [terkirim, setTerkirim] = useState<string | null>(null);
  const [isi, setIsi] = useState<IsiAturUlang>(KOSONG);
  const [selesai, setSelesai] = useState(false);
  /* Seperti form lain: teguran baru muncul setelah tombol ditekan. */
  const [dicoba, setDicoba] = useState(false);
  const [galatForm, setGalatForm] = useState<string | null>(null);

  const galatHp = dicoba && !terkirim ? periksaLupa(hp) : undefined;
  const galat = dicoba && terkirim ? periksaAturUlang(isi) : {};

  const ubah = (k: keyof IsiAturUlang) => (v: string) => {
    setIsi((x) => ({ ...x, [k]: v }));
    setGalatForm(null);
  };

  function kirimKode(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    if (periksaLupa(hp)) {
      document.getElementById(`${id}-hp`)?.focus();
      return;
    }
    if (!navigator.onLine) return setGalatForm(GALAT_JARINGAN);
    /* ponytail: belum ada SMS sungguhan — kode 6 angka apa pun diterima di
       data tiruan. Ganti dengan permintaan OTP saat task backend Fase 4. */
    setTerkirim(normalkanHp(hp));
    setDicoba(false);
  }

  function aturUlang(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const g = periksaAturUlang(isi);
    if (Object.keys(g).length) {
      document.getElementById(`${id}-${Object.keys(g)[0]}`)?.focus();
      return;
    }
    if (!navigator.onLine) return setGalatForm(GALAT_JARINGAN);
    setSelesai(true);
  }

  function gantiNomor() {
    setTerkirim(null);
    setIsi(KOSONG);
    setDicoba(false);
  }

  if (selesai) return <Selesai />;

  if (!terkirim)
    return (
      <form
        className="space-y-4 px-4 pb-10 pt-5"
        onSubmit={kirimKode}
        noValidate
      >
        <KotakGalat>{galatForm}</KotakGalat>
        <Isian
          id={`${id}-hp`}
          label="Nomor HP"
          bantuan="Kami kirim kode 6 angka lewat SMS ke nomor ini."
          value={hp}
          onChange={(v) => {
            setHp(v);
            setGalatForm(null);
          }}
          placeholder="0812 3456 7890"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          galat={galatHp}
        />
        <Tombol type="submit" lebar className="mt-1">
          Kirim kode
        </Tombol>
      </form>
    );

  return (
    <form className="space-y-4 px-4 pb-10 pt-5" onSubmit={aturUlang} noValidate>
      <KotakGalat>{galatForm}</KotakGalat>
      {/* Jawaban yang sama untuk semua nomor — tidak membocorkan nomor mana
          yang punya akun. */}
      <p
        aria-live="polite"
        className="rounded-kartu border border-line bg-card p-3 text-[13px] leading-snug text-ink-2"
      >
        Kalau <span className="font-semibold text-ink">{terkirim}</span>{" "}
        terdaftar, kodenya sudah dikirim lewat SMS. Biasanya sampai dalam satu
        menit.
      </p>

      <Isian
        id={`${id}-kode`}
        label="Kode dari SMS"
        bantuan="6 angka."
        value={isi.kode}
        onChange={ubah("kode")}
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        galat={galat.kode}
      />

      <Isian
        id={`${id}-sandi`}
        label="Kata sandi baru"
        bantuan="Minimal 8 karakter."
        value={isi.sandi}
        onChange={ubah("sandi")}
        placeholder="••••••••"
        type="password"
        autoComplete="new-password"
        galat={galat.sandi}
      />

      <Isian
        id={`${id}-ulang`}
        label="Ulangi kata sandi baru"
        bantuan="Supaya tidak salah ketik."
        value={isi.ulang}
        onChange={ubah("ulang")}
        placeholder="••••••••"
        type="password"
        autoComplete="new-password"
        galat={galat.ulang}
      />

      <Tombol type="submit" lebar className="mt-1">
        Simpan sandi baru
      </Tombol>

      <p className="text-center text-[13px] text-ink-2">
        Kode tidak datang?{" "}
        <button
          type="button"
          onClick={gantiNomor}
          className="font-semibold text-ink underline"
        >
          Kirim ulang atau ganti nomor
        </button>
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
          Sandi baru tersimpan
        </h2>
        <p className="mx-auto mt-1 max-w-[30ch] text-[14px] leading-snug text-ink-2">
          Masuk pakai nomor HP yang sama dan sandi yang baru saja kamu buat.
        </p>
        <div className="mt-5">
          <TombolLink href="/masuk" lebar>
            Masuk
          </TombolLink>
        </div>
      </Kartu>
    </div>
  );
}
