import Link from "next/link";
import { IkonLanjut } from "@/components/ikon";
import { Kartu, Label } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { ADDRESSES, PENGGUNA } from "@/lib/mock";
import { bulanTahun } from "@/lib/tanggal";

export const metadata = { title: "Profil — Pilah Yuk" };

/* 081234567890 → 0812-3456-7890: lebih gampang dicocokkan dengan mata. */
const hpTerbaca = (hp: string) => hp.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");

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
];

export default function ProfilPage() {
  const p = PENGGUNA;
  return (
    <main className="space-y-7">
      <header>
        <h1 className="text-[22px] font-bold leading-tight">Profil</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">
          Data akun dan alamat jemput kamu.
        </p>
      </header>

      <Kartu as="section" className="flex items-center gap-4 p-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-hijau text-[22px] font-bold text-white"
        >
          {p.nama.replace(/^(Bu|Pak)\s+/, "").charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold leading-tight">
            {p.nama}
          </p>
          <p className="text-[13px] text-ink-2">
            {p.peran === "pengurus" ? "Pengurus RT/RW" : "Warga"} · bergabung{" "}
            {bulanTahun(p.bergabung)}
          </p>
          <dl className="mt-2 space-y-0.5 text-[14px]">
            <div className="flex gap-2">
              <dt className="text-ink-3">HP</dt>
              <dd className="tabular-nums">{hpTerbaca(p.hp)}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="text-ink-3">Email</dt>
              <dd className="truncate">{p.email ?? "belum diisi"}</dd>
            </div>
          </dl>
        </div>
      </Kartu>

      <section className="space-y-3">
        <Label
          aksi={
            <span className="text-[13px] font-medium text-ink-2">
              {ADDRESSES.length} alamat
            </span>
          }
        >
          Alamat tersimpan
        </Label>
        <ul className="space-y-2">
          {ADDRESSES.map((a) => (
            <Kartu as="li" key={a.id} className="p-4">
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                {a.label}
                {a.isDefault && (
                  <span className="rounded-kartu border border-hijau/40 px-1.5 text-[11px] font-semibold text-hijau">
                    Utama
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[14px] leading-snug">{a.fullAddress}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
                {a.landmark} · {a.rwChannelName}
              </p>
            </Kartu>
          ))}
        </ul>
      </section>

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
