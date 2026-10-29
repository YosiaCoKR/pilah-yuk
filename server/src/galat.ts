/**
 * Apakah galat ini pelanggaran constraint/index bernama `nama`?
 *
 * Drizzle membungkus galat Postgres: pesan luarnya hanya memuat query yang
 * gagal, sementara nama constraint-nya ada di `cause`. Keduanya diperiksa,
 * jadi pemanggil tidak perlu tahu bentuk bungkusannya — dan tidak ikut
 * menelan kebocoran 500 kalau bungkusnya berubah.
 */
export function bentrokDengan(e: unknown, nama: string): boolean {
  const sebab = (e as { cause?: unknown } | null)?.cause;
  return String(e).includes(nama) || String(sebab).includes(nama);
}
