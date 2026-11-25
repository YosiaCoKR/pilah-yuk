import Link from "next/link";
import { IkonLanjut } from "@/components/ikon";
import { Kartu, Label } from "@/components/primitif";
import { IsiProfil } from "@/components/profil/isi-profil";
import { TombolLink } from "@/components/tombol";

export const metadata = { title: "Profil — Pilah Yuk" };

const MENU = [
  { href: "/langganan", label: "Langganan", ket: "Paket, status, dan tagihan" },
  {
    href: "/riwayat",
    label: "Riwayat jemput",
    ket: "Semua penjemputan & bukti",
  },
  {
    href: "/notifikasi",
    label: "Notifikasi",
    ket: "Pengingat dan kabar channel",
  },
  { href: "/bantuan", label: "Pusat bantuan", ket: "Jawaban pertanyaan umum" },
];

export default function ProfilPage() {
  return (
    <main className="space-y-7">
      <header>
        <h1 className="text-[22px] font-bold leading-tight">Profil</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">
          Data akun dan alamat jemput kamu.
        </p>
      </header>

      <IsiProfil />

      <section className="space-y-3">
        <Label>Lainnya</Label>
        <Kartu className="divide-y divide-line">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-paper"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  {m.label}
                </span>
                <span className="block text-[13px] text-ink-2">{m.ket}</span>
              </span>
              <IkonLanjut className="size-5 text-ink-3" />
            </Link>
          ))}
        </Kartu>
      </section>

      <TombolLink href="/masuk" varian="garis" lebar>
        Keluar
      </TombolLink>
    </main>
  );
}
