import { Elysia, ElysiaCustomStatusResponse } from "elysia";
import type { Db } from "./db";
import { ruteAlamat } from "./routes/alamat";
import { ruteJadwal } from "./routes/jadwal";
import { ruteLangganan } from "./routes/langganan";
import { rutePesanan } from "./routes/pesanan";
import { ruteRiwayat } from "./routes/riwayat";
import { ruteSlotWaktu } from "./routes/slot-waktu";

/**
 * `db` disuntik, bukan di-import sebagai singleton, supaya pemeriksaan bisa
 * menjalankan app yang sama di atas Postgres sementara tanpa kredensial.
 */
export function buatApp(db: Db) {
  return new Elysia()
    .onError(({ code, error, set }) => {
      if (code === "VALIDATION") {
        set.status = 422;
        return {
          pesan: "Ada isian yang belum benar.",
          rincian: error.all
            .filter((e) => "path" in e)
            .map((e) => ({
              kolom: String(e.path).replace(/^\//, ""),
              pesan: e.message,
            })),
        };
      }
      if (code === "NOT_FOUND") {
        set.status = 404;
        return { pesan: "Alamat URL tidak dikenal." };
      }
      /* Status yang sengaja dikembalikan handler (401, 404, …) lewat begitu
         saja — kalau tidak, semuanya tertelan jadi 500. */
      if (error instanceof ElysiaCustomStatusResponse) return error;

      console.error(error);
      set.status = 500;
      return { pesan: "Ada gangguan di server. Coba lagi sebentar lagi." };
    })
    .get("/sehat", () => ({ status: "ok" }))
    .group("/api", (app) => app.use(ruteAlamat(db)).use(ruteSlotWaktu(db)).use(rutePesanan(db)).use(ruteLangganan(db)).use(ruteJadwal(db)).use(ruteRiwayat(db)));
}
