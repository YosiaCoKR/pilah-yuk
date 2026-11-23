/**
 * Pembatas percobaan berjendela tetap: `maks` percobaan per `kunci` dalam
 * `jendelaMs`.
 *
 * Dibutuhkan karena semua permintaan ke Supabase Auth keluar dari IP server
 * ini — batas per-IP milik Supabase tidak membedakan warga, jadi tanpa pagar
 * di sini sandi dan kode SMS satu nomor bisa ditebak terus-menerus.
 *
 * ponytail: disimpan di memori satu proses — hilang saat restart dan tidak
 * dibagi antar-instance. Pindah ke Postgres/Redis kalau API dijalankan lebih
 * dari satu instance.
 */
export function buatPembatas(
  maks: number,
  jendelaMs: number,
  jam: () => number = Date.now,
) {
  const catatan = new Map<string, { n: number; sampai: number }>();

  return {
    /** Catat satu percobaan. `false` = sudah melewati batas, tolak. */
    boleh(kunci: string): boolean {
      const sekarang = jam();
      let c = catatan.get(kunci);
      if (!c || c.sampai <= sekarang) {
        c = { n: 0, sampai: sekarang + jendelaMs };
        catatan.set(kunci, c);
      }
      c.n++;
      /* Sapu catatan basi sesekali supaya peta tidak tumbuh tanpa batas. */
      if (catatan.size > 10_000)
        for (const [k, v] of catatan)
          if (v.sampai <= sekarang) catatan.delete(k);
      return c.n <= maks;
    },
    /** Berhasil masuk/verifikasi: hitungan nomor ini dimulai dari nol. */
    lupakan(kunci: string) {
      catatan.delete(kunci);
    },
  };
}
