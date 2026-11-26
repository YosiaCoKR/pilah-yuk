"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { kirim } from "@/lib/kirim";
import { Tombol } from "../tombol";

/**
 * Ajukan gabung. Masuk sebagai "menunggu" sampai pengurus menyetujui —
 * jadi setelah ditekan, tombolnya berubah jadi keterangan, bukan hilang.
 */
export function TombolGabung({
  channelId,
  menunggu,
}: {
  channelId: string;
  menunggu: boolean;
}) {
  const router = useRouter();
  const [pesan, setPesan] = useState<string | null>(null);
  const [jalan, mulai] = useTransition();

  if (menunggu)
    return (
      <p className="rounded-kartu border border-line bg-paper p-3 text-[13px] font-semibold text-ink-2">
        Permintaan terkirim — menunggu persetujuan pengurus.
      </p>
    );

  return (
    <>
      <Tombol
        lebar
        disabled={jalan}
        onClick={() =>
          mulai(async () => {
            const h = await kirim("POST", `/api/channel/${channelId}/gabung`);
            /* 409 = sudah pernah mengajukan; keadaan terbarunya dibaca ulang. */
            if (!h.ok && h.status !== 409) return setPesan(h.pesan);
            router.refresh();
          })
        }
      >
        {jalan ? "Mengirim…" : "Gabung channel ini"}
      </Tombol>
      {pesan && (
        <p role="alert" className="mt-2 text-[13px] text-alarm">
          {pesan}
        </p>
      )}
    </>
  );
}
