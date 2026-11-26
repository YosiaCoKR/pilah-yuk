import { kirim } from "./kirim";
import type { Ulasan } from "./types";

/**
 * Kirim penilaian. Satu penjemputan satu penilaian: kiriman kedua dijawab
 * 409 oleh server (unique constraint), bukan diam-diam menimpa yang lama.
 */
export const kirimUlasan = (
  u: Pick<Ulasan, "pickupId" | "nilai" | "tanda" | "catatan">,
) =>
  kirim("POST", "/api/umpan-balik", {
    pickupId: u.pickupId,
    rating: u.nilai,
    tags: u.tanda,
    comment: u.catatan || undefined,
  });
