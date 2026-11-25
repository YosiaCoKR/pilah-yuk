"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { normalkanHp, periksaProfil, type IsiProfil } from "@/lib/akun";
import { ubahAkun, useProfil } from "@/lib/toko-profil";
import { Isian } from "../primitif";
import { Tombol } from "../tombol";

export function FormAkun() {
  const { akun } = useProfil();
  const router = useRouter();
  const [isi, setIsi] = useState<IsiProfil>({
    nama: akun.nama,
    hp: akun.hp,
    email: akun.email ?? "",
  });
  /* Sama dengan form alamat: galat baru muncul setelah mencoba simpan. */
  const [dicoba, setDicoba] = useState(false);
  const [kirim, mulaiKirim] = useTransition();
  const galat = dicoba ? periksaProfil(isi) : {};

  const ubah = (k: keyof IsiProfil) => (v: string) =>
    setIsi((x) => ({ ...x, [k]: v }));

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const g = periksaProfil(isi);
    const pertama = Object.keys(g)[0];
    if (pertama) {
      document.getElementById(`akun-${pertama}`)?.focus();
      return;
    }
    mulaiKirim(() => {
      ubahAkun({
        nama: isi.nama.trim(),
        hp: normalkanHp(isi.hp),
        email: isi.email.trim() || null,
      });
      router.push("/profil");
    });
  }

  return (
    <form onSubmit={simpan} noValidate className="space-y-5 px-4 pb-40 pt-5">
      <Isian
        id="akun-nama"
        label="Nama"
        bantuan="Nama yang dipanggil petugas saat menjemput."
        value={isi.nama}
        onChange={ubah("nama")}
        placeholder="Bu Rina"
        autoComplete="name"
        galat={galat.nama}
      />
      <Isian
        id="akun-hp"
        label="Nomor HP"
        bantuan="Dipakai untuk masuk dan menerima pengingat jemput."
        value={isi.hp}
        onChange={ubah("hp")}
        placeholder="0812 3456 7890"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        galat={galat.hp}
      />
      <Isian
        id="akun-email"
        label="Email"
        bantuan="Untuk salinan tagihan langganan."
        value={isi.email}
        onChange={ubah("email")}
        placeholder="nama@contoh.id"
        type="email"
        inputMode="email"
        autoComplete="email"
        opsional
        galat={galat.email}
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-screen-sm">
          <Tombol type="submit" lebar disabled={kirim}>
            {kirim ? "Menyimpan…" : "Simpan profil"}
          </Tombol>
        </div>
      </div>
    </form>
  );
}
