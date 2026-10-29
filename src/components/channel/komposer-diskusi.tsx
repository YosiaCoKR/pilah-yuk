"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Tombol } from "../tombol";

/** Selaras dengan kolom `content` di Supabase; dipakai juga oleh pencacah. */
const BATAS = 500;

/** Di bawah ini pertanyaan belum bisa dijawab siapa pun. */
const MINIMAL = 4;

/**
 * Form tulis pesan dan balasan di papan diskusi.
 *
 * Satu form untuk dua tempat: utas baru dan balasan di dalam utas. Keduanya
 * butuh hal yang sama — batas panjang yang terlihat, tombol yang mati saat
 * tulisan masih kosong, dan isi yang bersih sebelum dikirim.
 *
 * Tulisan tidak dibuang saat pengiriman gagal: `isi` baru dikosongkan setelah
 * `onKirim` lolos, supaya warga tidak kehilangan paragraf yang baru diketik.
 */
export function KomposerDiskusi({
  ajakan,
  tombol,
  onKirim,
  onBatal,
  fokusAwal = false,
}: {
  ajakan: string;
  tombol: string;
  onKirim: (isi: string) => void;
  onBatal?: () => void;
  /** Balasan dibuka atas permintaan warga, jadi kursornya langsung di sana. */
  fokusAwal?: boolean;
}) {
  const [isi, setIsi] = useState("");
  const [salah, setSalah] = useState<string | null>(null);
  const [kirim, mulaiKirim] = useTransition();
  const kotak = useRef<HTMLTextAreaElement>(null);

  const bersih = isi.trim();
  const sisa = BATAS - isi.length;

  function simpan(e: FormEvent) {
    e.preventDefault();
    if (bersih.length < MINIMAL) {
      setSalah(
        bersih.length === 0
          ? "Tulis dulu pesannya."
          : `Tulis minimal ${MINIMAL} huruf supaya warga lain paham.`,
      );
      kotak.current?.focus();
      return;
    }
    setSalah(null);
    mulaiKirim(() => {
      onKirim(bersih);
      setIsi("");
    });
  }

  return (
    /* <form>, bukan tombol lepas: Enter, pembacaan layar, dan autofill bekerja
       apa adanya. Enter di dalam textarea tetap membuat baris baru. */
    <form onSubmit={simpan} className="space-y-2" noValidate>
      <label className="block">
        <span className="sr-only">{ajakan}</span>
        <textarea
          ref={kotak}
          value={isi}
          onChange={(e) => {
            setIsi(e.target.value);
            if (salah) setSalah(null);
          }}
          placeholder={ajakan}
          rows={3}
          maxLength={BATAS}
          autoFocus={fokusAwal}
          aria-invalid={salah ? true : undefined}
          aria-describedby={salah ? "galat-komposer" : undefined}
          className={`w-full resize-y rounded-kartu border bg-card p-3 text-[15px] leading-snug placeholder:text-ink-3 focus:outline-none ${
            salah ? "border-alarm" : "border-line focus:border-hijau"
          }`}
        />
      </label>

      {salah && (
        <p
          id="galat-komposer"
          role="alert"
          className="text-[13px] font-medium text-alarm"
        >
          {salah}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Tombol
          type="submit"
          disabled={kirim || bersih.length === 0}
          className="min-h-11"
        >
          {kirim ? "Mengirim…" : tombol}
        </Tombol>
        {onBatal && (
          <Tombol
            type="button"
            varian="halus"
            onClick={onBatal}
            className="min-h-11"
          >
            Batal
          </Tombol>
        )}
        {/* Pencacah muncul hanya saat batasnya mulai dekat — angka yang selalu
            terpampang cuma bikin warga menghitung, bukan menulis. */}
        {sisa <= 80 && (
          <span
            aria-live="polite"
            className={`angka ml-auto text-[13px] ${sisa <= 0 ? "font-semibold text-alarm" : "text-ink-2"}`}
          >
            sisa {sisa}
          </span>
        )}
      </div>
    </form>
  );
}
