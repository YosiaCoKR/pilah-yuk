"use client";

import Link from "next/link";
import { useState } from "react";
import { bulanTahun } from "@/lib/tanggal";
import { hapusAlamat, simpanAlamat, useProfil } from "@/lib/toko-profil";
import type { Address } from "@/lib/types";
import { IkonTambah } from "../ikon";
import { Lembar } from "../lembar";
import { FormAlamat } from "../pesan/form-alamat";
import { Kartu, Label, PenandaUtama } from "../primitif";

/* 081234567890 → 0812-3456-7890: lebih gampang dicocokkan dengan mata. */
const hpTerbaca = (hp: string) => hp.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");

/** Kartu akun + alamat tersimpan, keduanya bisa diubah di tempat. */
export function IsiProfil() {
  const { akun: p, alamat } = useProfil();
  /* null = lembar tertutup, "baru" = tambah, Address = ubah yang itu. */
  const [sasaran, setSasaran] = useState<Address | "baru" | null>(null);
  /* Naik tiap lembar dibuka → form dirender ulang dengan isian segar. */
  const [buka, setBuka] = useState(0);

  const bukaLembar = (s: Address | "baru") => {
    setSasaran(s);
    setBuka((n) => n + 1);
  };
  /* Alamat utama selalu di atas — itu yang dipakai untuk pesanan baru. */
  const urut = [...alamat].sort((a, b) => +b.isDefault - +a.isDefault);
  const ubah = typeof sasaran === "object" && sasaran ? sasaran : undefined;

  return (
    <>
      <Kartu as="section" className="flex items-start gap-4 p-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-hijau text-[22px] font-bold text-white"
        >
          {p.nama.replace(/^(Bu|Pak)\s+/, "").charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold leading-tight">
            {p.nama}
          </p>
          <p className="text-[13px] text-ink-2">
            {p.peran === "pengurus" ? "Pengurus RT/RW" : "Warga"} · bergabung{" "}
            {bulanTahun(p.bergabung)}
          </p>
          <dl className="mt-2 space-y-0.5 text-[14px]">
            <div className="flex gap-2">
              <dt className="text-ink-3">HP</dt>
              <dd className="tabular-nums">{hpTerbaca(p.hp)}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="text-ink-3">Email</dt>
              <dd className="truncate">{p.email ?? "belum diisi"}</dd>
            </div>
          </dl>
        </div>
        <Link
          href="/profil/ubah"
          className="shrink-0 rounded-kartu px-2 py-1 text-[14px] font-semibold text-hijau hover:bg-paper"
        >
          Ubah
        </Link>
      </Kartu>

      <section className="space-y-3">
        <Label
          aksi={
            <button
              type="button"
              onClick={() => bukaLembar("baru")}
              className="inline-flex min-h-9 items-center gap-1 rounded-kartu px-2 text-[13px] font-semibold text-hijau hover:bg-card"
            >
              <IkonTambah className="size-4" />
              Tambah
            </button>
          }
        >
          Alamat tersimpan
        </Label>
        <ul className="space-y-2">
          {urut.map((a) => (
            <Kartu as="li" key={a.id} className="p-4">
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                {a.label}
                {a.isDefault && <PenandaUtama />}
              </p>
              <p className="mt-0.5 text-[14px] leading-snug">{a.fullAddress}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
                {a.landmark ? `${a.landmark} · ` : ""}
                {a.rwChannelName}
              </p>
              <div className="mt-3 flex gap-4 text-[14px] font-semibold">
                <button
                  type="button"
                  onClick={() => bukaLembar(a)}
                  className="min-h-9 text-hijau"
                >
                  Ubah
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    onClick={() => simpanAlamat({ ...a, isDefault: true })}
                    className="min-h-9 text-ink-2"
                  >
                    Jadikan utama
                  </button>
                )}
                {/* Alamat terakhir tidak bisa dihapus: tanpa alamat, warga
                    tidak bisa memesan jemput sama sekali. */}
                {alamat.length > 1 && (
                  <button
                    type="button"
                    onClick={() => hapusAlamat(a.id)}
                    className="min-h-9 text-alarm"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </Kartu>
          ))}
        </ul>
      </section>

      <Lembar
        buka={sasaran !== null}
        onTutup={() => setSasaran(null)}
        judul={ubah ? `Ubah alamat ${ubah.label}` : "Tambah alamat jemput"}
      >
        <FormAlamat
          key={buka}
          awal={ubah}
          onBatal={() => setSasaran(null)}
          onSimpan={(a) => {
            simpanAlamat({ ...a, id: ubah?.id ?? `addr-${Date.now()}` });
            setSasaran(null);
          }}
        />
      </Lembar>
    </>
  );
}
