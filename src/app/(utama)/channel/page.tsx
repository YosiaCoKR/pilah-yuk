import { KartuChannel } from "@/components/channel/kartu-channel";
import { Kartu, Label } from "@/components/primitif";
import { daftarChannel } from "@/lib/data";
import { jarakTerbaca } from "@/lib/kalimat";

export const metadata = { title: "Channel RT/RW — Pilah Yuk" };

export default async function ChannelPage() {
  const semua = await daftarChannel();
  const milikku = semua.filter((c) => c.isMember);
  /* Yang terdekat lebih dulu (tanpa titik paling bawah) — sudah diurut API. */
  const lainnya = semua.filter((c) => !c.isMember);

  return (
    <main className="space-y-7">
      <header>
        <h1 className="text-[22px] font-bold leading-tight">Channel RT/RW</h1>
        <p className="mt-0.5 text-[14px] leading-snug text-ink-2">
          Tempat pengurus mengumumkan jadwal angkut dan warga berkoordinasi.
        </p>
      </header>

      {milikku.length > 0 && (
        <section className="space-y-3">
          <Label>Channel kamu</Label>
          <ul className="space-y-2">
            {milikku.map((c) => (
              <KartuChannel key={c.id} channel={c} />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <Label
          aksi={
            lainnya.length > 0 ? (
              <span className="text-[13px] text-ink-2">
                terdekat {jarakTerbaca(lainnya[0].distanceM)}
              </span>
            ) : undefined
          }
        >
          Channel terdekat
        </Label>

        {lainnya.length === 0 ? (
          <Kartu className="p-6 text-center">
            <p className="text-[15px] font-semibold">
              Belum ada channel lain di sekitarmu
            </p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Kalau RW-mu belum punya channel, pengurus bisa membuatnya lewat
              akun pengurus.
            </p>
          </Kartu>
        ) : (
          <ul className="space-y-2">
            {lainnya.map((c) => (
              <KartuChannel key={c.id} channel={c} />
            ))}
          </ul>
        )}
      </section>

      <Kartu className="p-4">
        <p className="text-[14px] font-semibold">
          Kenapa harus gabung channel?
        </p>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">
          Pesanan jemputmu masuk ke petugas channel sesuai alamat. Tanpa
          channel, tidak ada petugas yang menerima permintaan.
        </p>
      </Kartu>
    </main>
  );
}
