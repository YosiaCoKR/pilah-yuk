import { and, desc, eq, inArray } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { grupBaris, pilihBaris } from "../baris-pesanan";
import { auth } from "../auth";
import type { Db } from "../db";
import { pickups } from "../db/schema";

/**
 * Riwayat = pengangkutan yang sudah berakhir. Yang masih menunggu atau sedang
 * dijemput punya layarnya sendiri (Jadwal), jadi tidak ikut di sini.
 */
const SUDAH_BERAKHIR = ["selesai", "batal"] as const;

/** Tanggal panjang Indonesia: "Selasa, 4 November 2026". */
const tanggalPanjang = (iso: string) => {
  const [y, b, h] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Date.UTC(y, b - 1, h)));
};

const judulJenis = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);

/**
 * Tanda terima sebagai teks biasa.
 *
 * Teks, bukan PDF: warga mengirimnya lewat WhatsApp ke pengurus RT, dan di
 * sana teks bisa langsung dibaca di gelembung pesan tanpa diunduh dulu.
 * Bentuknya sengaja sama dengan yang dirakit layar riwayat — satu-satunya
 * bedanya, angka di sini datang dari basis data, bukan dari layar, jadi inilah
 * berkas yang bisa dipertanggungjawabkan di rapat.
 */
function teksBukti(b: Bukti) {
  return [
    "TANDA TERIMA PENGANGKUTAN SAMPAH",
    "Pilah Yuk",
    "",
    `Kode       : ${b.code}`,
    `Tanggal    : ${tanggalPanjang(b.tanggal)}`,
    `Jam        : ${b.jam ?? "-"}`,
    `Alamat     : ${b.alamatLabel} — ${b.alamatLengkap}`,
    `Channel    : ${b.channelName ?? "-"}`,
    `Petugas    : ${b.officerName ?? "-"}`,
    `Jenis      : ${b.jenis.map(judulJenis).join(", ") || "-"}`,
    `Berat total: ${Number(b.totalWeightKg ?? 0).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} kg`,
    /* null, bukan "" — baris kosong di atas memang pemisah yang disengaja,
       jadi hanya baris opsional yang boleh hilang. */
    b.notes ? `Catatan    : ${b.notes}` : null,
    "",
    `Diterbitkan ${tanggalPanjang(new Date().toISOString().slice(0, 10))} oleh aplikasi Pilah Yuk.`,
  ]
    .filter((baris) => baris !== null)
    .join("\n");
}

type Bukti = Awaited<ReturnType<typeof pilihBaris>>[number];

export const ruteRiwayat = (db: Db) =>
  new Elysia({ prefix: "/riwayat" })
    .use(auth)

    /**
     * Daftar riwayat pengangkutan warga, terbaru lebih dulu.
     *
     * Dikembalikan utuh, tanpa saringan status dan tanpa pencarian di server:
     * layar riwayat memerlukan seluruh daftarnya sekaligus untuk menghitung
     * angka pada tiap saringan dan total berat per bulan — angka yang dibawa
     * warga ke rapat RT. Menyaring di server justru membuat angka-angka itu
     * salah. Pencarian dan pengelompokan bulan dikerjakan di perangkat, yang
     * membuatnya tetap jalan saat koneksi lambat.
     *
     * Kalau riwayat satu warga kelak terlalu panjang untuk sekali kirim,
     * yang ditambahkan adalah halaman + ringkasan bulanan dari server —
     * bukan saringan status.
     */
    .get("/", async ({ penggunaId }) => {
      const baris = await pilihBaris(db)
        .where(
          and(
            eq(pickups.userId, penggunaId),
            inArray(pickups.status, [...SUDAH_BERAKHIR]),
          ),
        )
        .groupBy(...grupBaris)
        .orderBy(desc(pickups.pickupDate), desc(pickups.createdAt));

      return { data: baris };
    })

    /**
     * Unduh tanda terima satu pengangkutan.
     *
     * Hanya yang `selesai`: pengangkutan yang dibatalkan tidak punya timbangan
     * maupun petugas, jadi tanda terimanya akan jadi kertas kosong yang justru
     * menyesatkan kalau dibawa ke rapat RT. Yang belum diangkut, apalagi.
     *
     * Berkasnya dikirim sebagai lampiran teks, bukan JSON, supaya tautannya
     * bisa dibuka langsung dari peramban — tanpa kode di sisi warga yang
     * perlu merakit berkas lagi.
     */
    .get(
      "/:id/bukti",
      async ({ penggunaId, params, set }) => {
        const [bukti] = await pilihBaris(db)
          .where(
            and(
              eq(pickups.id, params.id),
              /* userId di WHERE: pengangkutan warga lain dijawab 404, bukan
                 403 — keberadaannya pun tidak perlu bocor. */
              eq(pickups.userId, penggunaId),
              eq(pickups.status, "selesai"),
            ),
          )
          .groupBy(...grupBaris);

        if (!bukti) {
          return status(404, { pesan: "Bukti pengangkutan tidak ditemukan." });
        }

        /* Kode datang dari basis data, tapi tetap dibersihkan: apa pun yang
           masuk ke header tidak boleh bisa menyelundupkan tanda kutip atau
           ganti baris. */
        const nama = `bukti-${bukti.code.replace(/[^\w.-]/g, "")}.txt`;
        set.headers["content-type"] = "text/plain; charset=utf-8";
        set.headers["content-disposition"] = `attachment; filename="${nama}"`;
        return teksBukti(bukti);
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    );
