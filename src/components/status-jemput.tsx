import type { PickupStatus } from "@/lib/types";

/**
 * Badge status penjemputan. Semua badge status di aplikasi datang dari sini,
 * supaya "menunggu" tidak pelan-pelan jadi "diproses" di satu layar dan
 * "dalam antrean" di layar lain — warga akan mengira itu tiga hal berbeda.
 *
 * `LiniStatus` punya kalimatnya sendiri dan memang begitu seharusnya: ia
 * menamai LANGKAH ("Petugas berangkat"), bukan KEADAAN ("Sedang dijemput").
 *
 * Tidak ada warna tong sampah di sini. Kuning berarti plastik dan biru
 * berarti kertas di seluruh aplikasi — memakainya lagi untuk status akan
 * membuat satu kuning yang sama berarti dua hal. Status memakai tangga
 * netral → hijau → merah: belum terjadi, berjalan, selesai, batal.
 */

type Gaya = {
  /** Kalimat utuh — dipakai saat badge berdiri sendiri. */
  panjang: string;
  /** Satu kata — dipakai saat konteksnya sudah jelas dari sekitarnya. */
  pendek: string;
  kelas: string;
  titik: string;
};

const GAYA: Record<PickupStatus, Gaya> = {
  menunggu: {
    panjang: "Menunggu dijemput",
    pendek: "Menunggu",
    /* Netral: belum ada yang terjadi, dan belum ada yang salah. */
    kelas: "border-line-kuat bg-paper text-ink-2",
    titik: "bg-ink-3",
  },
  dijemput: {
    panjang: "Sedang dijemput",
    pendek: "Dijemput",
    /* Hijau bergaris: sedang berjalan, belum selesai. */
    kelas: "border-hijau bg-card text-hijau",
    titik: "bg-hijau",
  },
  selesai: {
    panjang: "Selesai diangkut",
    pendek: "Selesai",
    kelas: "border-hijau/45 bg-hijau-tipis text-hijau",
    titik: "bg-hijau",
  },
  batal: {
    panjang: "Dibatalkan",
    pendek: "Batal",
    kelas: "border-alarm/45 bg-alarm-tipis text-alarm",
    titik: "bg-alarm",
  },
};

export function StatusJemput({
  status,
  ringkas = false,
  titik = false,
}: {
  status: PickupStatus;
  /** Satu kata, untuk baris daftar yang sudah penuh konteks. */
  ringkas?: boolean;
  /** Tambahkan titik warna — berguna saat badge berdiri sendirian. */
  titik?: boolean;
}) {
  const g = GAYA[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-kartu border px-2 py-0.5 text-[12px] font-semibold ${g.kelas}`}
    >
      {titik && (
        <span aria-hidden className={`size-1.5 rounded-full ${g.titik}`} />
      )}
      {ringkas ? g.pendek : g.panjang}
    </span>
  );
}

/** Kata status tanpa badge — untuk kalimat berjalan dan label aksesibilitas. */
export const kataStatus = (status: PickupStatus) => GAYA[status].panjang;
