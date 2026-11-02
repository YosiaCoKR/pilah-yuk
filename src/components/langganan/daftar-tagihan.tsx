import Link from "next/link";
import { rupiah, tanggalPendek } from "@/lib/tanggal";
import type { Invoice } from "@/lib/types";
import { IkonLanjut } from "../ikon";
import { Kartu } from "../primitif";

/**
 * Daftar tagihan. Dipakai di halaman status (dipotong) dan di halaman riwayat
 * pembayaran (utuh) — satu bentuk baris, jadi warga mengenali barisnya sama
 * di dua tempat. Tiap baris menuju detail pembayarannya.
 */
export function DaftarTagihan({ tagihan }: { tagihan: Invoice[] }) {
  if (tagihan.length === 0) {
    return (
      <Kartu className="p-4">
        <p className="text-[14px] leading-snug text-ink-2">
          Belum ada pembayaran. Tagihan pertama muncul di sini setelah kamu
          mengambil paket.
        </p>
      </Kartu>
    );
  }

  return (
    <ul className="space-y-2">
      {tagihan.map((t) => {
        const gagal = t.status === "gagal";
        return (
          <li key={t.id}>
            <Link
              href={`/langganan/tagihan/${t.id}`}
              className="flex items-center gap-2 rounded-kartu border border-line bg-card p-3 hover:border-line-kuat"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] font-semibold">{t.planName}</p>
                  <p
                    className={`angka shrink-0 text-[15px] font-bold ${
                      gagal ? "text-ink-3 line-through" : ""
                    }`}
                  >
                    {rupiah(t.amount)}
                  </p>
                </div>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  {tanggalPendek(t.paidAt)} · {t.method}
                </p>
                {/* Yang gagal dijelaskan sebabnya, bukan cuma dicap merah:
                    halaman ini dibuka justru untuk mencari tahu kenapa. */}
                {gagal && (
                  <p className="mt-1.5 text-[13px] leading-snug text-alarm">
                    Gagal. {t.failureReason}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-ink-3" aria-hidden>
                <IkonLanjut className="size-5" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
