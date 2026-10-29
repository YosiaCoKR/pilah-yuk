import { and, desc, eq, inArray } from "drizzle-orm";
import { Elysia } from "elysia";
import { grupBaris, pilihBaris } from "../baris-pesanan";
import { auth } from "../auth";
import type { Db } from "../db";
import { pickups } from "../db/schema";

/**
 * Riwayat = pengangkutan yang sudah berakhir. Yang masih menunggu atau sedang
 * dijemput punya layarnya sendiri (Jadwal), jadi tidak ikut di sini.
 */
const SUDAH_BERAKHIR = ["selesai", "batal"] as const;

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
    });
