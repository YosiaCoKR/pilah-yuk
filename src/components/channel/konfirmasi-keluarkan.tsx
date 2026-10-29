"use client";

import type { ChannelMember } from "@/lib/types";
import { Lembar } from "../lembar";
import { Tombol } from "../tombol";

export type AksiKeluar = "tolak" | "keluarkan";

/**
 * Konfirmasi sebelum seseorang dikeluarkan dari channel.
 *
 * Dua aksi memakai lembar ini — menolak permintaan gabung dan mengeluarkan
 * anggota aktif. Keduanya tidak bisa dibatalkan oleh pengurus sendiri, jadi
 * akibatnya disebut dengan nama orangnya, bukan "data ini akan dihapus".
 *
 * Lembarnya dibangun di atas <dialog> (lihat `Lembar`): Esc, kurungan fokus,
 * dan lapisan teratas datang dari peramban, bukan dari pustaka modal.
 */
export function KonfirmasiKeluarkan({
  anggota,
  aksi,
  onTutup,
  onYa,
}: {
  /** null berarti lembarnya tertutup — tidak ada yang sedang dikonfirmasi. */
  anggota: ChannelMember | null;
  aksi: AksiKeluar;
  onTutup: () => void;
  onYa: () => void;
}) {
  const menolak = aksi === "tolak";

  return (
    <Lembar
      buka={anggota !== null}
      onTutup={onTutup}
      judul={menolak ? "Tolak permintaan gabung" : "Keluarkan anggota"}
    >
      {anggota && (
        <div className="space-y-4">
          <div>
            <p className="text-[16px] font-bold leading-tight">
              {anggota.name}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
              {anggota.houseLabel}
            </p>
          </div>

          <p className="text-[14px] leading-snug">
            {menolak
              ? `${anggota.name} tidak jadi masuk channel ini dan harus mengajukan lagi kalau ingin bergabung.`
              : `Pesanan jemput dari ${anggota.name} tidak lagi diteruskan ke petugas channel ini. Dia bisa mengajukan gabung lagi nanti.`}
          </p>

          <div className="flex flex-col gap-2">
            <Tombol varian="bahaya" lebar onClick={onYa}>
              {menolak ? "Tolak permintaan" : "Keluarkan dari channel"}
            </Tombol>
            <Tombol varian="garis" lebar onClick={onTutup}>
              Batal
            </Tombol>
          </div>
        </div>
      )}
    </Lembar>
  );
}
