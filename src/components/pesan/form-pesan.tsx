"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ADDRESSES, slotById } from "@/lib/mock";
import type { Address, DraftOrder } from "@/lib/types";
import { GerbangLangganan } from "../gerbang-langganan";
import { PengingatLangganan } from "../pengingat-langganan";
import { Label } from "../primitif";
import { Tombol } from "../tombol";
import { Ringkasan } from "./ringkasan";
import { SeksiAlamat } from "./seksi-alamat";
import { SeksiJenis } from "./seksi-jenis";
import { SeksiWaktu } from "./seksi-waktu";

type Bagian = "alamat" | "jenis" | "waktu";

/**
 * One scrolling form rather than a four-step wizard: warga can see the whole
 * order at once and fix any part without walking back through screens.
 */
export function FormPesan() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftOrder>({
    addressId: "addr-1",
    categories: [],
    date: null,
    timeSlotId: null,
    notes: "",
  });
  const [mengirim, setMengirim] = useState(false);

  /* Addresses live here so a newly added one is immediately selectable.
     Swaps for the API call when the backend layer lands. */
  const [daftarAlamat, setDaftarAlamat] = useState<Address[]>(ADDRESSES);

  const alamat = daftarAlamat.find((a) => a.id === draft.addressId);
  const slot = slotById(draft.timeSlotId);

  const kurang = [
    !draft.addressId && "alamat",
    draft.categories.length === 0 && "jenis sampah",
    !draft.date && "tanggal",
    !draft.timeSlotId && "jam",
  ].filter(Boolean) as string[];
  const lengkap = kurang.length === 0;

  function lompat(bagian: Bagian) {
    document
      .getElementById(`bagian-${bagian}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function kirim() {
    if (!lengkap || mengirim) return;
    setMengirim(true);
    const q = new URLSearchParams({
      alamat: draft.addressId ?? "",
      jenis: draft.categories.join(","),
      tanggal: draft.date ?? "",
      slot: draft.timeSlotId ?? "",
      catatan: draft.notes.trim(),
    });
    router.push(`/pesan/terkirim?${q}`);
  }

  return (
    <>
      <div className="space-y-7 px-4 pb-44 pt-5">
        <PengingatLangganan ringkas />

        <div id="bagian-alamat" className="scroll-mt-20">
          <SeksiAlamat
            daftar={daftarAlamat}
            terpilih={draft.addressId}
            onPilih={(addressId) => setDraft((d) => ({ ...d, addressId }))}
            onTambah={(baru) => {
              const id = `addr-${Date.now()}`;
              setDaftarAlamat((xs) => [
                // Only one address can be primary, so adding a new primary
                // demotes the previous one rather than leaving two marked.
                ...(baru.isDefault
                  ? xs.map((a) => ({ ...a, isDefault: false }))
                  : xs),
                { ...baru, id },
              ]);
              setDraft((d) => ({ ...d, addressId: id }));
            }}
          />
        </div>

        <div id="bagian-jenis" className="scroll-mt-20">
          <SeksiJenis
            terpilih={draft.categories}
            onUbah={(categories) => setDraft((d) => ({ ...d, categories }))}
          />
        </div>

        <div id="bagian-waktu" className="scroll-mt-20">
          <SeksiWaktu
            tanggal={draft.date}
            slot={draft.timeSlotId}
            onTanggal={(date) => setDraft((d) => ({ ...d, date }))}
            onSlot={(timeSlotId) => setDraft((d) => ({ ...d, timeSlotId }))}
          />
        </div>

        <section className="space-y-3">
          <Label>Catatan untuk petugas</Label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            rows={3}
            maxLength={200}
            placeholder="Mis. karung ditaruh di depan pagar"
            className="w-full resize-none rounded-kartu border border-line bg-card p-3 text-[15px] placeholder:text-ink-3"
          />
        </section>

        <Ringkasan
          alamat={alamat}
          slot={slot}
          tanggal={draft.date}
          jenis={draft.categories}
          catatan={draft.notes}
          onLompat={lompat}
        />
      </div>

      {/* Sticky action: always one thumb-reach away. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-[2px]">
        <div className="mx-auto max-w-screen-sm">
          {/* Gerbangnya di atas tombol, bukan di dalam `kirim` — warga tahu
              sejak awal kalau pesanannya tidak akan bisa dikirim. */}
          <GerbangLangganan>
            {!lengkap && (
              <p className="mb-2 text-[13px] text-ink-2">
                Masih perlu: {kurang.join(", ")}.
              </p>
            )}
            <Tombol lebar disabled={!lengkap || mengirim} onClick={kirim}>
              {mengirim ? "Mengirim…" : "Kirim permintaan jemput"}
            </Tombol>
          </GerbangLangganan>
        </div>
      </div>
    </>
  );
}
