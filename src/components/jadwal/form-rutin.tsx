"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WASTE_CATEGORIES, WASTE_COLOR } from "@/lib/mock";
import { urutkanHari } from "@/lib/kalimat";
import { simpanJadwal } from "@/lib/toko-jadwal";
import { RingkasanRutin } from "./ringkasan-rutin";
import type {
  Address,
  RecurringSchedule,
  Subscription,
  TimeSlot,
  WasteKey,
  Weekday,
} from "@/lib/types";
import { GerbangLangganan } from "../gerbang-langganan";
import { IkonCentang, IkonJam, IkonPeta } from "../ikon";
import { Label, PenandaUtama } from "../primitif";
import { Sakelar } from "../sakelar";
import { Tombol } from "../tombol";

const HARI: { nama: Weekday; pendek: string }[] = [
  { nama: "Senin", pendek: "Sen" },
  { nama: "Selasa", pendek: "Sel" },
  { nama: "Rabu", pendek: "Rab" },
  { nama: "Kamis", pendek: "Kam" },
  { nama: "Jumat", pendek: "Jum" },
  { nama: "Sabtu", pendek: "Sab" },
  { nama: "Minggu", pendek: "Min" },
];

export function FormRutin({
  awal,
  alamat,
  slot,
  langganan,
}: {
  /** `null` = warga belum punya jadwal rutin; form membuat yang baru. */
  awal: RecurringSchedule | null;
  alamat: Address[];
  slot: TimeSlot[];
  langganan: Subscription | null;
}) {
  const router = useRouter();
  const [hari, setHari] = useState<Weekday[]>(awal?.days ?? []);
  const [slotId, setSlotId] = useState(awal?.timeSlotId ?? slot[0]?.id ?? "");
  const [alamatId, setAlamatId] = useState(
    awal?.addressId ??
      alamat.find((a) => a.isDefault)?.id ??
      alamat[0]?.id ??
      "",
  );
  const [jenis, setJenis] = useState<WasteKey[]>(awal?.categories ?? []);
  const [pengingat, setPengingat] = useState(awal?.reminderEnabled ?? true);
  const [galat, setGalat] = useState<string | null>(null);
  /* Lihat catatan di FormJeda: flag useState bisa tertinggal menyala karena
     cache segmen App Router. */
  const [tersimpan, mulaiSimpan] = useTransition();

  const toggleHari = (h: Weekday) =>
    setHari((x) => (x.includes(h) ? x.filter((y) => y !== h) : [...x, h]));

  const toggleJenis = (k: WasteKey) =>
    setJenis((x) => {
      /* Aturan yang sama dengan halaman pesan: campuran berarti belum
         terpilah, jadi tidak bisa digabung dengan kategori spesifik. */
      if (k === "campuran") return x.includes("campuran") ? [] : ["campuran"];
      const tanpa = x.filter((y) => y !== "campuran");
      return tanpa.includes(k) ? tanpa.filter((y) => y !== k) : [...tanpa, k];
    });

  const kurang = [
    !alamatId && "alamat (tambah dulu di Profil)",
    hari.length === 0 && "hari",
    jenis.length === 0 && "jenis sampah",
  ].filter(Boolean) as string[];
  const lengkap = kurang.length === 0;

  /* Hari disusun ulang mengikuti urutan minggu, bukan urutan ditekan —
     "Selasa & Jumat" harus terbaca begitu, bukan "Jumat & Selasa". */
  const hariTerurut = urutkanHari(hari);
  /* Jadwal "seandainya disimpan", dirakit dari keadaan form. */
  const alamatTerpilih = alamat.find((a) => a.id === alamatId);
  const pratinjau: RecurringSchedule = {
    id: awal?.id ?? "",
    startDate: awal?.startDate ?? "",
    endDate: awal?.endDate ?? null,
    isPaused: awal?.isPaused ?? false,
    pausedUntil: awal?.pausedUntil ?? null,
    days: hariTerurut,
    timeSlotId: slotId,
    slot: slot.find((s) => s.id === slotId),
    addressId: alamatId,
    address: alamatTerpilih ?? {
      label: "",
      fullAddress: "",
      landmark: "",
      rwChannelName: "",
    },
    categories: jenis,
    reminderEnabled: pengingat,
  };

  function simpan() {
    mulaiSimpan(async () => {
      const h = await simpanJadwal(awal?.id ?? null, pratinjau);
      if (!h.ok) return setGalat(Object.values(h.rincian)[0] ?? h.pesan);
      router.push("/jadwal");
      router.refresh();
    });
  }

  return (
    <div className="space-y-7 px-4 pb-40 pt-5">
      <section className="space-y-3">
        <Label>Hari penjemputan</Label>
        <p className="-mt-1 text-[13px] leading-snug text-ink-2">
          Petugas datang setiap hari yang kamu pilih.
        </p>
        <ul className="flex gap-1.5">
          {HARI.map((h) => {
            const aktif = hari.includes(h.nama);
            return (
              <li key={h.nama} className="flex-1">
                <button
                  type="button"
                  onClick={() => toggleHari(h.nama)}
                  aria-pressed={aktif}
                  aria-label={h.nama}
                  className={`flex min-h-12 w-full items-center justify-center rounded-kartu border text-[13px] font-semibold ${
                    aktif
                      ? "border-hijau bg-hijau text-white"
                      : "border-line bg-card text-ink-2 hover:border-line-kuat"
                  }`}
                >
                  {h.pendek}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <Label>Jam jemput</Label>
        <ul className="space-y-2">
          {slot.map((s) => {
            const aktif = s.id === slotId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={s.full}
                  onClick={() => setSlotId(s.id)}
                  aria-pressed={aktif}
                  className={`flex w-full items-center gap-3 rounded-kartu border p-3 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
                    aktif
                      ? "border-hijau bg-hijau-tipis"
                      : "border-line bg-card enabled:hover:border-line-kuat"
                  }`}
                >
                  <IkonJam
                    className={`size-5 shrink-0 ${aktif ? "text-hijau" : "text-ink-3"}`}
                  />
                  <span className="angka flex-1 text-[16px] font-bold">
                    {s.range}
                  </span>
                  <span
                    className={`text-[12px] ${s.full ? "font-semibold text-alarm" : "text-ink-2"}`}
                  >
                    {s.note}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <Label>Alamat</Label>
        <ul className="space-y-2">
          {alamat.map((a) => {
            const aktif = a.id === alamatId;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setAlamatId(a.id)}
                  aria-pressed={aktif}
                  className={`flex w-full items-start gap-3 rounded-kartu border p-3 text-left ${
                    aktif
                      ? "border-hijau bg-hijau-tipis"
                      : "border-line bg-card hover:border-line-kuat"
                  }`}
                >
                  <IkonPeta
                    className={`mt-0.5 size-5 shrink-0 ${aktif ? "text-hijau" : "text-ink-3"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold">
                        {a.label}
                      </span>
                      {a.isDefault && <PenandaUtama />}
                    </span>
                    <span className="block text-[13px] leading-snug text-ink-2">
                      {a.fullAddress}
                    </span>
                  </span>
                  {aktif && (
                    <IkonCentang className="mt-0.5 size-5 shrink-0 text-hijau" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <Label>Jenis sampah</Label>
        <div className="grid grid-cols-2 gap-2">
          {WASTE_CATEGORIES.map((c) => {
            const aktif = jenis.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleJenis(c.key)}
                aria-pressed={aktif}
                className={`flex min-h-14 items-center gap-2.5 rounded-kartu border px-3 text-left ${
                  aktif
                    ? "border-hijau bg-hijau-tipis"
                    : "border-line bg-card hover:border-line-kuat"
                }`}
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: WASTE_COLOR[c.key] }}
                />
                <span className="flex-1 text-[14px] font-semibold">
                  {c.name}
                </span>
                {aktif && <IkonCentang className="size-4 text-hijau" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <Label>Pengingat</Label>
        <Sakelar
          nyala={pengingat}
          onUbah={setPengingat}
          judul="Ingatkan sehari sebelum"
          keterangan="Dikirim lewat WhatsApp ke nomor di profilmu."
          matikanKeterangan="Tidak ada pengingat — kamu perlu ingat sendiri."
        />
      </section>

      {/* Pratinjau memakai perakit kalimat yang sama dengan kartu jadwal dan
          halaman detail — warga melihat persis kalimat yang nanti muncul. */}
      <section className="space-y-3">
        <Label>Hasilnya</Label>
        <div className="rounded-kartu border border-line bg-card p-4">
          {hariTerurut.length === 0 ? (
            <p className="text-[15px] text-ink-3">
              Pilih dulu harinya untuk melihat jadwalnya.
            </p>
          ) : (
            <RingkasanRutin jadwal={pratinjau} />
          )}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-[2px]">
        <div className="mx-auto max-w-screen-sm">
          {/* Jadwal rutin tanpa paket berjalan adalah janji yang tidak akan
              ditepati — petugas tidak punya dasar untuk datang. */}
          <GerbangLangganan langganan={langganan} perluKuota={false}>
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
            <Tombol lebar disabled={!lengkap || tersimpan} onClick={simpan}>
              {tersimpan ? "Menyimpan…" : "Simpan jadwal rutin"}
            </Tombol>
          </GerbangLangganan>
        </div>
      </div>
    </div>
  );
}
