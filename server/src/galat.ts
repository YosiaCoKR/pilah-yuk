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

type Skema = {
  type?: string;
  error?: unknown;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  const?: unknown;
  anyOf?: Skema[];
};

/**
 * Satu galat validasi skema Elysia/TypeBox → kalimat untuk warga.
 *
 * Bawaan TypeBox berbahasa Inggris dan teknis ("Expected union value").
 * Diterjemahkan dari skema + nilainya — bukan dari nomor jenis galat
 * TypeBox, yang bisa bergeser antar versi. Pesan `error` di skema menang.
 */
export function pesanValidasi(skema: Skema = {}, nilai: unknown): string {
  if (typeof skema.error === "string") return skema.error;
  if (nilai === undefined || nilai === null) return "Wajib diisi.";

  /* t.Union literal = daftar pilihan. Selain itu, anyOf adalah bungkusan
     Elysia untuk angka (angka | teks-angka): pakai cabang angkanya. */
  if (skema.anyOf) {
    if (skema.anyOf.every((s) => "const" in s))
      return "Pilihannya tidak dikenal.";
    const angka = skema.anyOf.find(
      (s) => s.type === "integer" || s.type === "number",
    );
    if (angka)
      return pesanValidasi({ ...angka, ...skema, anyOf: undefined }, nilai);
  }
  if ("const" in skema) return "Pilihannya tidak dikenal.";

  switch (skema.type) {
    case "string": {
      if (typeof nilai !== "string") return "Harus berupa teks.";
      if (skema.minLength !== undefined && nilai.length < skema.minLength)
        return skema.minLength <= 1
          ? "Wajib diisi."
          : `Minimal ${skema.minLength} karakter.`;
      if (skema.maxLength !== undefined && nilai.length > skema.maxLength)
        return `Terlalu panjang — maksimal ${skema.maxLength} karakter.`;
      if (skema.format === "uuid") return "Pilihannya tidak dikenal.";
      if (skema.format === "date")
        return "Tanggalnya tidak terbaca (pakai tahun-bulan-tanggal).";
      return "Formatnya belum sesuai.";
    }
    case "integer":
    case "number": {
      const n = Number(nilai);
      if (typeof nilai === "boolean" || Number.isNaN(n))
        return "Harus berupa angka.";
      if (skema.type === "integer" && !Number.isInteger(n))
        return "Harus bilangan bulat.";
      if (skema.minimum !== undefined && n < skema.minimum)
        return `Minimal ${skema.minimum}.`;
      if (skema.maximum !== undefined && n > skema.maximum)
        return `Maksimal ${skema.maximum}.`;
      return "Angkanya belum sesuai.";
    }
    case "boolean":
      return "Harus ya atau tidak.";
    case "array": {
      if (!Array.isArray(nilai)) return "Harus berupa daftar.";
      if (skema.minItems !== undefined && nilai.length < skema.minItems)
        return `Pilih minimal ${skema.minItems}.`;
      if (skema.maxItems !== undefined && nilai.length > skema.maxItems)
        return `Paling banyak ${skema.maxItems}.`;
      return "Isi daftarnya belum sesuai.";
    }
    case "object":
      return "Datanya belum lengkap.";
  }
  return "Isiannya belum benar.";
}
