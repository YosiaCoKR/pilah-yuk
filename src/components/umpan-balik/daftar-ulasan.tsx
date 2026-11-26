import Link from "next/link";
import type { umpanBalik } from "@/lib/data";
import { tanggalPendek } from "@/lib/tanggal";
import { Kartu, Label } from "../primitif";
import { RingkasUlasan } from "./ulasan-pickup";

export function DaftarUlasan({
  menunggu: daftarMenunggu,
  terkirim,
}: Awaited<ReturnType<typeof umpanBalik>>) {
  /* Yang paling baru selesai paling atas — ingatannya masih segar. API
     sudah mengurutkannya; `id` disamakan dengan bentuk pesanan lain. */
  const menunggu = daftarMenunggu.map((p) => ({ ...p, id: p.pickupId }));

  return (
    <main className="space-y-7 px-4 pb-10 pt-5">
      {menunggu.length > 0 && (
        <section className="space-y-3">
          <Label
            aksi={
              <span className="text-[13px] font-medium text-ink-2">
                {menunggu.length} jemput
              </span>
            }
          >
            Menunggu penilaianmu
          </Label>
          <Kartu className="divide-y divide-line">
            {menunggu.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">
                    {p.officerName ?? "Petugas"}
                  </span>
                  <span className="block text-[13px] text-ink-2">
                    {tanggalPendek(p.pickupDate)} · {p.code}
                  </span>
                </span>
                <Link
                  href={`/umpan-balik/${p.id}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-kartu border border-line-kuat px-3 text-[14px] font-semibold hover:bg-paper"
                >
                  Nilai
                </Link>
              </div>
            ))}
          </Kartu>
        </section>
      )}

      <section className="space-y-3">
        <Label>Sudah dinilai</Label>
        {terkirim.length === 0 ? (
          <Kartu className="p-6 text-center">
            <p className="text-[14px] leading-snug text-ink-2">
              Belum ada penilaian. Setelah penjemputan selesai, nilai petugasnya
              di sini.
            </p>
          </Kartu>
        ) : (
          <ul className="space-y-2">
            {terkirim.map((u) => {
              return (
                <Kartu as="li" key={u.pickupId} className="p-4">
                  <Link
                    href={`/riwayat/${u.pickupId}`}
                    className="mb-2 block text-[13px] text-ink-2 hover:text-ink"
                  >
                    {u.officerName ?? "Petugas"} · {tanggalPendek(u.pickupDate)}
                  </Link>
                  <RingkasUlasan u={u} />
                </Kartu>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
