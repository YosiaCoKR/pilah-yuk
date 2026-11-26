"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kirim } from "@/lib/kirim";
import { bayarPaket, type TagihanBaru } from "@/lib/toko-langganan";
import { iramaJemput, satuanSiklus } from "@/lib/kalimat";
import { rupiah } from "@/lib/tanggal";
import type { Invoice, Plan } from "@/lib/types";
import { IkonCentang } from "../ikon";
import { Kartu, Label } from "../primitif";
import { Tombol } from "../tombol";

type Metode = "qris" | "ewallet" | "va";

/* Kanal yang benar-benar dipakai orang di Indonesia. Tiga metode, bukan tiga
   belas: tiap tambahan kanal adalah satu keputusan lagi sebelum membayar. */
const METODE: {
  id: Metode;
  nama: string;
  terbaca: string;
  pilihan?: string[];
}[] = [
  {
    id: "qris",
    nama: "QRIS",
    terbaca: "Pindai dari aplikasi bank atau e-wallet mana pun.",
  },
  {
    id: "ewallet",
    nama: "E-wallet",
    terbaca: "Buka aplikasinya, tinggal setujui pembayaran.",
    pilihan: ["GoPay", "OVO", "DANA", "ShopeePay"],
  },
  {
    id: "va",
    nama: "Transfer bank",
    terbaca: "Nomor virtual account, bisa dibayar dari m-banking atau ATM.",
    pilihan: ["BCA", "Mandiri", "BRI", "BNI"],
  },
];

/** Seberapa sering layar menanyakan apakah pembayaran sudah terbaca. */
const SELANG_MS = 4_000;

export function FormBayar({ paket }: { paket: Plan }) {
  const router = useRouter();
  const [metode, setMetode] = useState<Metode>("qris");
  const [kanal, setKanal] = useState<Record<Metode, string>>({
    qris: "",
    ewallet: "GoPay",
    va: "BCA",
  });
  const [tersalin, setTersalin] = useState(false);
  /* Tiga tahap, bukan satu tombol "saya sudah bayar": QRIS dan virtual account
     dibayar di aplikasi lain, jadi yang memberi tahu bahwa uangnya masuk
     adalah penyedia pembayaran — bukan warga. */
  const [tahap, setTahap] = useState<"pilih" | "menunggu" | "diterima">(
    "pilih",
  );

  const [tagihan, setTagihan] = useState<TagihanBaru | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const nomorVa = tagihan?.vaNumber ?? "";

  async function bayar() {
    setGalat(null);
    setMengirim(true);
    const h = await bayarPaket(
      paket.id,
      metode === "va" ? "va_bank" : metode,
      metode === "qris" ? undefined : kanal[metode],
    );
    setMengirim(false);
    if (!h.ok) return setGalat(h.pesan);
    setTagihan(h.data);
    setTahap("menunggu");
  }

  async function salinVa() {
    try {
      await navigator.clipboard.writeText(nomorVa.replace(/\s/g, ""));
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      /* Clipboard ditolak (izin, atau http). Nomornya tetap terbaca di layar
         dan bisa diketik — jadi kegagalannya tidak perlu diumumkan. */
    }
  }

  /*
    Pembayaran terbaca sendiri: webhook Midtrans menandai tagihan, layar ini
    menanyakannya berkala. Selama belum dibayar API menjawab 404.
    ponytail: polling 4 detik; ganti Supabase Realtime kalau perlu seketika.
  */
  useEffect(() => {
    if (tahap !== "menunggu" || !tagihan) return;
    const t = setInterval(async () => {
      const h = await kirim<Invoice>(
        "GET",
        `/api/langganan/tagihan/${tagihan.id}`,
      );
      if (!h.ok) return;
      if (h.data.status === "lunas") return setTahap("diterima");
      setGalat(
        h.data.failureReason ?? "Pembayaran gagal. Coba cara bayar lain.",
      );
      setTahap("pilih");
    }, SELANG_MS);
    return () => clearInterval(t);
  }, [tahap, tagihan]);

  /* Jeda singkat setelah "diterima" supaya warga sempat membacanya sebelum
     halamannya berganti. */
  useEffect(() => {
    if (tahap !== "diterima") return;
    const t = setTimeout(() => {
      router.push("/langganan");
      router.refresh();
    }, 1_400);
    return () => clearTimeout(t);
  }, [tahap, router]);

  const menunggu = tahap === "menunggu";
  const selesai = tahap === "diterima";
  const namaMetode = METODE.find((m) => m.id === metode)!.nama;

  return (
    <div className="space-y-7 px-4 pb-40 pt-5">
      <Kartu className="divide-y divide-line">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{paket.name}</p>
            <p className="text-[13px] text-ink-2">{iramaJemput(paket)}</p>
          </div>
          <p className="angka shrink-0 text-[20px] font-bold">
            {rupiah(paket.price)}
          </p>
        </div>
        <p className="px-4 py-2.5 text-[13px] text-ink-2">
          Ditagih tiap {satuanSiklus(paket.billingCycle)}. Bisa dihentikan kapan
          saja lewat halaman langganan.
        </p>
      </Kartu>

      {tahap === "pilih" ? (
        <section className="space-y-3">
          <Label>Cara bayar</Label>

          <ul className="space-y-2">
            {METODE.map((m) => {
              const ini = m.id === metode;
              return (
                <li key={m.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-kartu border bg-card p-3 ${
                      ini
                        ? "border-hijau"
                        : "border-line hover:border-line-kuat"
                    }`}
                  >
                    <input
                      type="radio"
                      name="metode"
                      value={m.id}
                      checked={ini}
                      onChange={() => setMetode(m.id)}
                      className="mt-1 size-5 shrink-0 accent-hijau"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">
                        {m.nama}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">
                        {m.terbaca}
                      </span>
                    </span>
                  </label>

                  {/* Rincian cuma muncul untuk metode yang dipilih: tiga panel
                    terbuka sekaligus membuat halaman ini jadi daftar bacaan,
                    bukan pilihan. */}
                  {ini && (
                    <div className="mt-2 rounded-kartu border border-line bg-paper p-3">
                      {/* Kodenya baru terbit setelah pembayaran dibuat, jadi
                        yang bisa dikatakan sekarang cuma apa yang akan
                        terjadi — bukan bingkai kosong menunggu gambar. */}
                      {m.id === "qris" && (
                        <p className="text-[13px] leading-snug text-ink-2">
                          Kode QRIS muncul di layar ini setelah kamu menekan
                          Bayar. Berlaku 15 menit sejak muncul.
                        </p>
                      )}

                      {m.pilihan && (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {m.pilihan.map((nama) => {
                              const terpilih = kanal[m.id] === nama;
                              return (
                                <button
                                  key={nama}
                                  type="button"
                                  aria-pressed={terpilih}
                                  onClick={() =>
                                    setKanal((k) => ({ ...k, [m.id]: nama }))
                                  }
                                  className={`min-h-11 rounded-kartu border px-3 text-[14px] font-semibold ${
                                    terpilih
                                      ? "border-hijau bg-hijau text-white"
                                      : "border-line-kuat bg-card text-ink hover:bg-paper"
                                  }`}
                                >
                                  {nama}
                                </button>
                              );
                            })}
                          </div>

                          {m.id === "va" && (
                            <p className="mt-3 text-[13px] leading-snug text-ink-2">
                              Nomor virtual account {kanal.va} muncul setelah
                              kamu menekan Bayar.
                            </p>
                          )}

                          {m.id === "ewallet" && (
                            <p className="mt-3 text-[13px] leading-snug text-ink-2">
                              Kamu akan dibawa ke aplikasi {kanal.ewallet} untuk
                              menyetujui pembayaran, lalu kembali ke sini.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="space-y-3">
          <Label>{namaMetode}</Label>
          <Kartu className="space-y-3 p-4">
            {metode === "qris" && (
              <div className="flex flex-col items-center gap-2 text-center">
                {tagihan?.qrUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- gambar QR dari Midtrans, bukan aset kita */
                  <img
                    src={tagihan.qrUrl}
                    alt={`Kode QRIS untuk ${rupiah(paket.price)}`}
                    className="aspect-square w-52 rounded-kartu border border-line-kuat bg-white p-2"
                  />
                ) : (
                  <p className="text-[12px] leading-snug text-ink-3">
                    Kode QRIS belum diterima dari penyedia pembayaran.
                  </p>
                )}
                <p className="max-w-[32ch] text-[13px] leading-snug text-ink-2">
                  Pindai dari aplikasi bank atau e-wallet mana pun. Kode berlaku
                  15 menit.
                </p>
              </div>
            )}

            {metode === "ewallet" && (
              /* Benar-benar urutan langkah, jadi diberi nomor. */
              <ol className="space-y-2 text-[14px] leading-snug">
                <Langkah n={1}>
                  {tagihan?.deeplink ? (
                    <a
                      href={tagihan.deeplink}
                      className="font-semibold underline"
                    >
                      Buka aplikasi {kanal.ewallet}
                    </a>
                  ) : (
                    <>Buka aplikasi {kanal.ewallet}.</>
                  )}
                </Langkah>
                <Langkah n={2}>
                  Setujui pembayaran {rupiah(paket.price)} ke Pilah Yuk.
                </Langkah>
                <Langkah n={3}>Kembali ke halaman ini.</Langkah>
              </ol>
            )}

            {metode === "va" && (
              <NomorVa
                bank={kanal.va}
                nomor={nomorVa}
                jumlah={paket.price}
                tersalin={tersalin}
                onSalin={salinVa}
              />
            )}
          </Kartu>
        </section>
      )}

      {tahap === "pilih" && (
        <p className="text-[13px] leading-snug text-ink-3">
          Kuota jemput masuk begitu pembayaran terbaca — biasanya di bawah satu
          menit. Kalau lebih lama, cek halaman langganan.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-[2px]">
        <div className="mx-auto max-w-screen-sm">
          {galat && (
            <p role="alert" className="mb-2 text-[13px] text-alarm">
              {galat}
            </p>
          )}
          {tahap === "pilih" ? (
            <Tombol lebar disabled={mengirim} onClick={bayar}>
              {mengirim ? "Membuat tagihan…" : `Bayar ${rupiah(paket.price)}`}
            </Tombol>
          ) : (
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`size-2.5 shrink-0 rounded-full ${
                  selesai ? "bg-hijau" : "animate-pulse bg-ink-3"
                }`}
              />
              <div className="min-w-0 flex-1">
                {/* Diumumkan ke pembaca layar: statusnya berubah tanpa ada
                    yang menekan apa pun. */}
                <p
                  aria-live="polite"
                  className="flex items-center gap-1.5 text-[14px] font-semibold"
                >
                  {selesai && <IkonCentang className="size-4 text-hijau" />}
                  {selesai ? "Pembayaran diterima" : "Menunggu pembayaran"}
                </p>
                <p className="text-[13px] leading-snug text-ink-2">
                  {selesai
                    ? "Kuota jemput sudah masuk."
                    : "Halaman ini berubah sendiri begitu pembayaran terbaca."}
                </p>
              </div>
              {menunggu && (
                <Tombol
                  varian="garis"
                  onClick={() => setTahap("pilih")}
                  className="min-h-11 shrink-0 px-3 text-[14px]"
                >
                  Ubah
                </Tombol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Nomor virtual account: angkanya besar dan bisa disalin sekali tekan. */
function NomorVa({
  bank,
  nomor,
  jumlah,
  tersalin,
  onSalin,
}: {
  bank: string;
  nomor: string;
  jumlah: number;
  tersalin: boolean;
  onSalin: () => void;
}) {
  return (
    <div>
      <p className="text-[13px] text-ink-2">Nomor virtual account {bank}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="angka flex-1 text-[18px] font-bold">{nomor}</p>
        <Tombol
          varian="garis"
          onClick={onSalin}
          className="min-h-11 px-3 text-[14px]"
        >
          {tersalin ? "Tersalin" : "Salin"}
        </Tombol>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink-2">
        Masukkan nomor ini sebagai tujuan transfer. Jumlahnya harus persis{" "}
        {rupiah(jumlah)}.
      </p>
    </div>
  );
}

function Langkah({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="angka grid size-6 shrink-0 place-items-center rounded-full border border-line-kuat text-[12px] font-bold text-ink-2">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
