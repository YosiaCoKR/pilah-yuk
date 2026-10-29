"use client";

import { useState } from "react";
import type { Address } from "@/lib/types";
import { IkonCentang, IkonPeta, IkonTambah } from "../ikon";
import { Lembar } from "../lembar";
import { Label } from "../primitif";
import { FormAlamat } from "./form-alamat";

export function SeksiAlamat({
  daftar,
  terpilih,
  onPilih,
  onTambah,
}: {
  daftar: Address[];
  terpilih: string | null;
  onPilih: (id: string) => void;
  onTambah: (alamat: Omit<Address, "id">) => void;
}) {
  const [bukaForm, setBukaForm] = useState(false);
  const aktifItem = daftar.find((a) => a.id === terpilih);

  return (
    <section className="space-y-3">
      <Label
        aksi={
          <button
            type="button"
            onClick={() => setBukaForm(true)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-hijau"
          >
            <IkonTambah className="size-4" />
            Tambah
          </button>
        }
      >
        Alamat jemput
      </Label>

      <ul className="space-y-2">
        {daftar.map((a) => {
          const aktif = a.id === terpilih;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onPilih(a.id)}
                aria-pressed={aktif}
                className={`flex w-full items-start gap-3 rounded-kartu border p-3 text-left ${
                  aktif
                    ? "border-hijau bg-hijau-tipis"
                    : "border-line bg-card hover:border-line-kuat"
                }`}
              >
                <IkonPeta
                  className={`mt-0.5 size-5 shrink-0 ${
                    aktif ? "text-hijau" : "text-ink-3"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{a.label}</span>
                    {a.isDefault && (
                      <span className="rounded-kartu border border-line bg-paper px-1.5 py-px text-[11px] font-semibold text-ink-2">
                        Utama
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">
                    {a.fullAddress}
                  </span>
                  {a.landmark && (
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">
                      Patokan: {a.landmark}
                    </span>
                  )}
                </span>
                {aktif && (
                  <IkonCentang className="mt-0.5 size-5 shrink-0 text-hijau" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Which channel serves this address decides who gets the order, so it
          is stated here rather than left for warga to work out. */}
      {aktifItem && (
        <p className="rounded-kartu border border-line bg-card px-3 py-2 text-[13px] leading-snug text-ink-2">
          Dilayani{" "}
          <span className="font-semibold text-ink">
            {aktifItem.rwChannelName}
          </span>
          .
        </p>
      )}

      <Lembar
        buka={bukaForm}
        onTutup={() => setBukaForm(false)}
        judul="Tambah alamat jemput"
      >
        <FormAlamat
          onBatal={() => setBukaForm(false)}
          onSimpan={(a) => {
            onTambah(a);
            setBukaForm(false);
          }}
        />
      </Lembar>
    </section>
  );
}
