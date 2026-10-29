"use client";

import { useState } from "react";
import { lamaAnggota, umurHari } from "@/lib/kalimat";
import { hapusAnggota, setujuiAnggota, useAnggota } from "@/lib/toko-anggota";
import type { ChannelMember } from "@/lib/types";
import { Kartu, Label } from "../primitif";
import { Tombol } from "../tombol";
import { KonfirmasiKeluarkan, type AksiKeluar } from "./konfirmasi-keluarkan";

/**
 * Kelola anggota channel — layar kerja pengurus.
 *
 * Permintaan gabung di atas karena itu satu-satunya bagian yang menuntut
 * keputusan; daftar aktif di bawahnya hanya perlu bisa ditelusuri. Dua aksi
 * yang menghapus orang dari channel (tolak & keluarkan) selalu lewat lembar
 * konfirmasi — pengurus menekannya di ponsel, sambil berdiri.
 */
export function DaftarAnggota({ channelId }: { channelId: string }) {
  const anggota = useAnggota(channelId);
  /* Satu lembar untuk seluruh daftar: yang disimpan adalah siapa yang sedang
     dikonfirmasi, bukan satu keadaan per baris. */
  const [konfirmasi, setKonfirmasi] = useState<{
    anggota: ChannelMember;
    aksi: AksiKeluar;
  } | null>(null);

  const menunggu = anggota.filter((a) => a.status === "menunggu");
  const aktif = anggota.filter((a) => a.status === "aktif");

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <Label
          aksi={
            menunggu.length > 0 ? (
              <span className="angka rounded-kartu border border-alarm/45 bg-alarm-tipis px-2 py-0.5 text-[12px] font-semibold text-alarm">
                {menunggu.length} baru
              </span>
            ) : undefined
          }
        >
          Permintaan gabung
        </Label>

        {menunggu.length === 0 ? (
          <Kartu className="p-4">
            <p className="text-[14px] leading-snug text-ink-2">
              Tidak ada permintaan yang menunggu. Permintaan baru muncul di sini
              begitu warga memilih channel ini.
            </p>
          </Kartu>
        ) : (
          <ul className="space-y-2">
            {menunggu.map((a) => (
              <Kartu as="li" key={a.id} className="p-4">
                <Identitas anggota={a} />
                <p className="mt-1 text-[13px] text-ink-3">
                  mengajukan {umurHari(a.agoDays)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Tombol
                    className="min-h-11"
                    onClick={() => setujuiAnggota(channelId, a.id)}
                  >
                    Setujui
                  </Tombol>
                  <Tombol
                    varian="garis"
                    className="min-h-11"
                    onClick={() =>
                      setKonfirmasi({ anggota: a, aksi: "tolak" })
                    }
                  >
                    Tolak
                  </Tombol>
                </div>
              </Kartu>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <Label
          aksi={
            <span className="angka text-[13px] text-ink-2">
              {aktif.length} warga
            </span>
          }
        >
          Anggota aktif
        </Label>

        {aktif.length === 0 ? (
          <Kartu className="p-4">
            <p className="text-[14px] leading-snug text-ink-2">
              Belum ada anggota aktif di channel ini.
            </p>
          </Kartu>
        ) : (
          <Kartu className="overflow-hidden">
            <ul className="divide-y divide-line">
              {aktif.map((a) => (
                <li key={a.id} className="p-4">
                  <Identitas anggota={a} />
                  <p className="mt-1 text-[13px] text-ink-3">
                    anggota {lamaAnggota(a.agoDays)}
                  </p>
                  {/* Pengurus tidak bisa dikeluarkan dari layar ini — itu
                      urusan pergantian pengurus, bukan kelola anggota. */}
                  {!a.isPengurus && (
                    <div className="mt-2">
                      <Tombol
                        varian="garis"
                        className="min-h-11"
                        onClick={() =>
                          setKonfirmasi({ anggota: a, aksi: "keluarkan" })
                        }
                      >
                        Keluarkan
                      </Tombol>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Kartu>
        )}
      </section>

      <KonfirmasiKeluarkan
        anggota={konfirmasi?.anggota ?? null}
        aksi={konfirmasi?.aksi ?? "keluarkan"}
        onTutup={() => setKonfirmasi(null)}
        onYa={() => {
          if (!konfirmasi) return;
          hapusAnggota(channelId, konfirmasi.anggota.id);
          setKonfirmasi(null);
        }}
      />
    </div>
  );
}

function Identitas({ anggota }: { anggota: ChannelMember }) {
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold leading-tight">
        {anggota.name}
        {anggota.isPengurus && (
          <span className="rounded-kartu border border-hijau/45 bg-hijau-tipis px-1.5 py-px text-[12px] font-semibold text-hijau">
            Pengurus
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
        {anggota.houseLabel}
      </p>
    </>
  );
}
