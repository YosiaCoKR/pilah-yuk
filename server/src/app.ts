import { Elysia, ElysiaCustomStatusResponse } from "elysia";
import type { PenyediaAkun } from "./akun";
import type { Db } from "./db";
import { pesanValidasi } from "./galat";
import type { Gateway } from "./pembayaran";
import { ruteAkun } from "./routes/akun";
import { ruteAlamat } from "./routes/alamat";
import { ruteChannel } from "./routes/channel";
import { ruteJadwal } from "./routes/jadwal";
import { ruteLangganan } from "./routes/langganan";
import { rutePanduan } from "./routes/panduan";
import { rutePesanan } from "./routes/pesanan";
import { ruteProfil } from "./routes/profil";
import { ruteRiwayat } from "./routes/riwayat";
import { ruteSlotWaktu } from "./routes/slot-waktu";
import { ruteUmpanBalik } from "./routes/umpan-balik";
import { ruteWebhookBayar } from "./routes/webhook-bayar";

/**
 * `db` disuntik, bukan di-import sebagai singleton, supaya pemeriksaan bisa
 * menjalankan app yang sama di atas Postgres sementara tanpa kredensial.
 */
export function buatApp(
  db: Db,
  gateway?: Gateway,
  midtransServerKey?: string,
  akun?: PenyediaAkun,
) {
  return (
    new Elysia()
      .onError(({ code, error, set }) => {
        if (code === "VALIDATION") {
          set.status = 422;
          /* Satu pesan per kolom (TypeBox bisa melaporkan satu kolom beberapa
           kali), dalam bahasa warga — lihat `pesanValidasi`. */
          const rincian = new Map<string, string>();
          for (const e of error.all) {
            if (!("path" in e)) continue;
            const kolom = String(e.path)
              .replace(/^\//, "")
              .replaceAll("/", ".");
            if (!rincian.has(kolom))
              rincian.set(kolom, pesanValidasi(e.schema as object, e.value));
          }
          return {
            pesan: "Ada isian yang belum benar.",
            rincian: [...rincian].map(([kolom, pesan]) => ({ kolom, pesan })),
          };
        }
        /* JSON rusak = salah kiriman klien, bukan gangguan server (dulu 500). */
        if (code === "PARSE") {
          set.status = 400;
          return {
            pesan:
              "Data yang dikirim tidak terbaca. Muat ulang halaman lalu coba lagi.",
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
      /* Dibaca plugin `auth` di setiap route: token → id warga. */
      .decorate("kenaliToken", akun?.kenali)
      .get("/sehat", () => ({ status: "ok" }))
      .group("/api", (app) =>
        app
          .use(ruteAkun(db, akun))
          .use(ruteAlamat(db))
          .use(ruteProfil(db))
          .use(ruteSlotWaktu(db))
          .use(rutePesanan(db))
          .use(ruteLangganan(db, gateway))
          .use(ruteJadwal(db))
          .use(ruteRiwayat(db))
          .use(ruteChannel(db))
          .use(rutePanduan(db))
          .use(ruteUmpanBalik(db))
          .use(ruteWebhookBayar(db, midtransServerKey)),
      )
  );
}
