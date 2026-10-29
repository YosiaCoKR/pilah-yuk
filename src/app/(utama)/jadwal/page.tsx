import Link from "next/link";
import { BarisJadwal } from "@/components/baris-jadwal";
import { KartuRutin } from "@/components/kartu-rutin";
import { Kartu, Label } from "@/components/primitif";
import { TombolLink } from "@/components/tombol";
import { PICKUPS } from "@/lib/mock";
import { bulanTahun } from "@/lib/tanggal";

export const metadata = { title: "Jadwal — Pilah Yuk" };

export default function JadwalPage() {
  /* Jadwal mendatang = yang belum selesai, diurut dari yang paling dekat. */
  const mendatang = PICKUPS.filter(
    (p) => p.status === "menunggu" || p.status === "dijemput",
  ).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));

  return (
    <main className="space-y-7">
      <header>
        <h1 className="text-[22px] font-bold leading-tight">Jadwal</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">
          Kapan petugas datang ke rumahmu.
        </p>
      </header>

      <KartuRutin />

      <section className="space-y-3">
        <Label
          aksi={
            <span className="text-[13px] font-medium text-ink-2">
              {mendatang.length} jemput
            </span>
          }
        >
          Jemput mendatang
        </Label>

        {mendatang.length === 0 ? (
          <Kartu className="p-6 text-center">
            <p className="text-[15px] font-semibold">
              Belum ada jemput terjadwal
            </p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Atur jadwal rutin supaya petugas datang tanpa perlu kamu pesan
              berulang.
            </p>
            <div className="mt-4">
              <TombolLink href="/pesan" lebar>
                Pesan jemput sampah
              </TombolLink>
            </div>
          </Kartu>
        ) : (
          <ul className="space-y-2">
            {mendatang.map((p, i) => {
              /* Pemisah bulan hanya muncul saat bulannya benar-benar
                 berganti — bukan judul hias di setiap kelompok. */
              const bulanBaru =
                i === 0 ||
                bulanTahun(p.pickupDate) !==
                  bulanTahun(mendatang[i - 1].pickupDate);

              return (
                <li key={p.id} className="space-y-2">
                  {bulanBaru && i > 0 && (
                    <p className="pt-3 text-[13px] font-semibold text-ink-2">
                      {bulanTahun(p.pickupDate)}
                    </p>
                  )}
                  <BarisJadwal pickup={p} tampilkanJarak={i === 0} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <Label>Butuh lebih?</Label>
        <Kartu className="p-4">
          <p className="text-[14px] leading-snug">
            Jadwal rutin sudah mencakup jemput mingguanmu. Kalau ada sampah
            tambahan di luar jadwal, pesan jemput sekali jalan.
          </p>
          <div className="mt-3">
            <Link
              href="/pesan"
              className="flex min-h-11 items-center justify-center rounded-kartu border border-line-kuat bg-card text-[14px] font-semibold hover:bg-paper"
            >
              Pesan jemput tambahan
            </Link>
          </div>
        </Kartu>
      </section>
    </main>
  );
}
