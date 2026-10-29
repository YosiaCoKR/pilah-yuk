import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Varian = "utama" | "garis" | "halus" | "bahaya";

/* 48px minimum height throughout — sized for a thumb, not a cursor. */
const DASAR =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-kartu px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";

const VARIAN: Record<Varian, string> = {
  utama:
    "bg-hijau text-white active:bg-hijau-tekan hover:bg-hijau-tekan border border-transparent",
  garis:
    "border border-line-kuat bg-card text-ink hover:bg-paper active:bg-paper",
  halus: "border border-transparent text-ink-2 hover:bg-paper active:bg-paper",
  /* Aksi yang menghapus sesuatu. Warna alarm dipakai hanya di sini supaya
     tetap berarti "tidak bisa dibatalkan". */
  bahaya:
    "bg-alarm text-white hover:bg-alarm/90 active:bg-alarm/90 border border-transparent",
};

export function Tombol({
  varian = "utama",
  lebar,
  className = "",
  children,
  ...rest
}: ComponentProps<"button"> & {
  varian?: Varian;
  lebar?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className={`${DASAR} ${VARIAN[varian]} ${lebar ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TombolLink({
  varian = "utama",
  lebar,
  className = "",
  children,
  ...rest
}: ComponentProps<typeof Link> & {
  varian?: Varian;
  lebar?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      className={`${DASAR} ${VARIAN[varian]} ${lebar ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
