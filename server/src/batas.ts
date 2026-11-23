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
        /* Peta penuh oleh nomor yang sedang terkunci: tolak kunci baru
           daripada melepas salah satu kunci itu. */
        if (!rapikan(sekarang)) return false;
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
    paling sering sekali per detik (bukan di tiap panggilan). Di atas
    MAKS_KUNCI, yang dibuang adalah catatan tertua yang BELUM mencapai batas
    — nomor yang sedang terkunci tidak pernah dilepas oleh banjir kunci lain.
    `false` = seluruh peta berisi nomor terkunci.

    ponytail: di memori satu proses; ganti ke Redis kalau API berjalan di
    lebih dari satu instance.
  */
  function rapikan(sekarang: number): boolean {
    if (catatan.size >= SAPU_MULAI && sekarang >= sapuLagi) {
      sapuLagi = sekarang + 1000;
      for (const [k, v] of catatan) if (v.sampai <= sekarang) catatan.delete(k);
    }
    while (catatan.size >= MAKS_KUNCI) {
      let buang: string | undefined;
      for (const [k, v] of catatan)
        if (v.n < maks) {
          buang = k;
          break;
        }
      if (buang === undefined) return false;
      catatan.delete(buang);
    }
    return true;
  }
}

const SAPU_MULAI = 10_000;
const MAKS_KUNCI = 100_000;
