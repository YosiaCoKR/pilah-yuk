import { inArray } from "drizzle-orm";
import type { Db } from "./db";
import { wasteCategories } from "./db/schema";

/**
 * Terjemahkan slug jenis sampah ("organik", "plastik", …) jadi baris kategori.
 *
 * Dipakai pesanan satuan maupun jadwal rutin. Aturannya sama di keduanya, jadi
 * tinggal di satu tempat: kalau aturan "campuran tidak bisa digabung" berubah,
 * ia tidak boleh berubah hanya di separuh aplikasi.
 *
 * Mengembalikan `galat` berisi badan respons 422 siap kirim, bukan melempar —
 * pemanggilnya yang memutuskan status, sesuai gaya route lain.
 */
export async function kategoriDariSlug(db: Db, slug: string[]) {
  const unik = [...new Set(slug)];

  const kategori = await db
    .select({ id: wasteCategories.id, slug: wasteCategories.slug })
    .from(wasteCategories)
    .where(inArray(wasteCategories.slug, unik));

  if (kategori.length !== unik.length) {
    const dikenal = new Set(kategori.map((k) => k.slug));
    return {
      galat: {
        pesan: "Ada jenis sampah yang tidak dikenal.",
        rincian: unik.filter((s) => !dikenal.has(s)),
      },
    } as const;
  }

  /* "Campuran" berarti belum terpilah, jadi tidak masuk akal digabung dengan
     kategori spesifik — aturan yang sama ditegakkan di UI. */
  if (unik.includes("campuran") && unik.length > 1) {
    return {
      galat: {
        pesan:
          "Campuran tidak bisa digabung dengan jenis lain. Pilih salah satu.",
      },
    } as const;
  }

  return { unik, kategori } as const;
}
