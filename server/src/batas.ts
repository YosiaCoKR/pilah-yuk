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
  let sapuLagi = 0;

  return {
    /** Catat satu percobaan. `false` = sudah melewati batas, tolak. */
    boleh(kunci: string): boolean {
      const sekarang = jam();
      let c = catatan.get(kunci);
      if (!c || c.sampai <= sekarang) {
        rapikan(sekarang);
        c = { n: 0, sampai: sekarang + jendelaMs };
        catatan.delete(kunci); // pindah ke ujung: urutan Map = urutan umur
        catatan.set(kunci, c);
      }
      c.n++;
      return c.n <= maks;
    },
    /** Berhasil masuk/verifikasi: hitungan nomor ini dimulai dari nol. */
    lupakan(kunci: string) {
      catatan.delete(kunci);
    },
  };

  /*
    Peta tidak boleh tumbuh tanpa batas oleh banjir kunci baru. Sapuan penuh
    paling sering sekali per detik (bukan di tiap panggilan), dan di atas
    MAKS_KUNCI catatan tertua dibuang.

    ponytail: membuang catatan tertua berarti banjir 100 ribu nomor berbeda
    bisa menghapus hitungan satu nomor. Untuk itu penyerang perlu 100 ribu
    panggilan ke Supabase Auth — jauh lebih mahal dari 5 tebakan yang
    didapatnya. Ganti ke penyimpanan bersama (Redis) bila itu berubah.
  */
  function rapikan(sekarang: number) {
    if (catatan.size < SAPU_MULAI || sekarang < sapuLagi) {
      if (catatan.size < MAKS_KUNCI) return;
    } else {
      sapuLagi = sekarang + 1000;
      for (const [k, v] of catatan) if (v.sampai <= sekarang) catatan.delete(k);
    }
    while (catatan.size >= MAKS_KUNCI)
      catatan.delete(catatan.keys().next().value!);
  }
}

const SAPU_MULAI = 10_000;
const MAKS_KUNCI = 100_000;
