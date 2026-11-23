import { eq, lt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { percobaanAkun } from "./db/schema";

/**
 * Pembatas percobaan berjendela tetap: `maks` percobaan per `kunci` dalam
 * `jendelaMs`, disimpan di tabel `percobaan_akun`.
 *
 * Dibutuhkan karena semua permintaan ke Supabase Auth keluar dari IP server
 * ini — batas per-IP milik Supabase tidak membedakan warga, jadi tanpa pagar
 * di sini sandi dan kode SMS satu nomor bisa ditebak terus-menerus.
 *
 * Di Postgres, bukan di memori: versi memori harus membatasi jumlah kunci,
 * dan batas itu sendiri jadi celah — membanjiri nomor acak bisa melepas
 * nomor yang terkunci atau mengunci semua nomor baru.
 *
 * ponytail: batas per nomor tanpa dimensi IP/perangkat, jadi orang lain bisa
 * sengaja menghabiskan jatah satu nomor (terkunci ≤ 1 jam). Tambahkan kunci
 * per-IP setelah header IP dari platform deploy bisa dipercaya.
 */
export function buatPembatas(db: Db, maks: number, jendelaMs: number) {
  return {
    /** Catat satu percobaan. `false` = sudah melewati batas, tolak. */
    async boleh(kunci: string): Promise<boolean> {
      /* Satu upsert atomik: dua permintaan bersamaan tidak bisa membaca
         hitungan yang sama lalu sama-sama lolos. Jendela yang sudah lewat
         dimulai ulang di pernyataan yang sama. */
      const lewat = sql`${percobaanAkun.sampai} <= now()`;
      const [r] = await db
        .insert(percobaanAkun)
        .values({
          kunci,
          jumlah: 1,
          sampai: sql`now() + ${jendelaMs} * interval '1 millisecond'`,
        })
        .onConflictDoUpdate({
          target: percobaanAkun.kunci,
          set: {
            jumlah: sql`case when ${lewat} then 1 else ${percobaanAkun.jumlah} + 1 end`,
            sampai: sql`case when ${lewat} then excluded.sampai else ${percobaanAkun.sampai} end`,
          },
        })
        .returning({ jumlah: percobaanAkun.jumlah });

      /* ponytail: sapuan acak 1% supaya baris basi tidak menumpuk tanpa
         perlu cron. Pindah ke pg_cron kalau tabelnya ternyata ramai. */
      if (Math.random() < 0.01)
        await db
          .delete(percobaanAkun)
          .where(lt(percobaanAkun.sampai, sql`now()`));

      return r.jumlah <= maks;
    },

    /** Berhasil masuk/verifikasi: hitungan kunci ini dimulai dari nol. */
    async lupakan(kunci: string) {
      await db.delete(percobaanAkun).where(eq(percobaanAkun.kunci, kunci));
    },
  };
}
