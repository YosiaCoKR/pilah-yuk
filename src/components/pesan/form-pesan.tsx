"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { kirim as kirimApi } from "@/lib/kirim";
import { simpanAlamat } from "@/lib/toko-profil";
import type { Address, DraftOrder, Subscription, TimeSlot } from "@/lib/types";
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
export function FormPesan({
  alamat: alamatAwal,
  langganan,
}: {
  alamat: Address[];
  langganan: Subscription | null;
}) {
  const router = useRouter();
  /* Alamat yang ditambah di sini tersimpan ke profil lewat API. */
  const [daftarAlamat, setDaftarAlamat] = useState(alamatAwal);
  const [daftarSlot, setDaftarSlot] = useState<TimeSlot[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftOrder>({
    addressId: daftarAlamat.find((a) => a.isDefault)?.id ?? null,
    categories: [],
    date: null,
    timeSlotId: null,
    notes: "",
  });
  const [mengirim, setMengirim] = useState(false);

  const alamat = daftarAlamat.find((a) => a.id === draft.addressId);
  const slot = daftarSlot.find((s) => s.id === draft.timeSlotId);

  /* Kuota tiap jam berbeda per tanggal: dibaca ulang setiap tanggal ganti. */
  useEffect(() => {
    if (!draft.date) return;
    let batal = false;
    kirimApi<TimeSlot[]>("GET", `/api/slot-waktu?tanggal=${draft.date}`).then(
      (h) => {
        if (batal) return;
        if (!h.ok) return setGalat(h.pesan);
        setDaftarSlot(h.data);
        /* Jam yang tadi dipilih bisa penuh di tanggal baru. */
        setDraft((d) =>
          h.data.some((s) => s.id === d.timeSlotId && !s.full)
            ? d
            : { ...d, timeSlotId: null },
        );
      },
    );
    return () => {
      batal = true;
    };
  }, [draft.date]);

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

  async function kirim() {
    if (!lengkap || mengirim) return;
    setMengirim(true);
    setGalat(null);
    const h = await kirimApi<{ id: string }>("POST", "/api/pesanan", {
      addressId: draft.addressId,
      jenis: draft.categories,
      tanggal: draft.date,
      timeSlotId: draft.timeSlotId,
      catatan: draft.notes.trim() || undefined,
    });
    if (!h.ok) {
      setMengirim(false);
      return setGalat(Object.values(h.rincian)[0] ?? h.pesan);
    }
    router.push(`/pesan/terkirim?id=${h.data.id}`);
  }

  return (
    <>
      <div className="space-y-7 px-4 pb-44 pt-5">
        <PengingatLangganan langganan={langganan} ringkas />

        <div id="bagian-alamat" className="scroll-mt-20">
          <SeksiAlamat
            daftar={daftarAlamat}
            terpilih={draft.addressId}
            onPilih={(addressId) => setDraft((d) => ({ ...d, addressId }))}
            onTambah={async (baru) => {
              const h = await simpanAlamat(baru);
              if (!h.ok) return setGalat(h.pesan);
              setDaftarAlamat((xs) => [
                ...xs.map((a) =>
                  baru.isDefault ? { ...a, isDefault: false } : a,
                ),
                {
                  ...h.data,
                  landmark: h.data.landmark ?? "",
                  rwChannelName: "",
                },
              ]);
              setDraft((d) => ({ ...d, addressId: h.data.id }));
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
            daftarSlot={draft.date ? daftarSlot : []}
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
          <GerbangLangganan langganan={langganan}>
            {galat && (
              <p role="alert" className="mb-2 text-[13px] text-alarm">
                {galat}
              </p>
            )}
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
