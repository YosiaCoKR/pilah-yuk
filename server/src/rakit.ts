import { buatSupabaseAuth } from "./akun";
import { buatApp } from "./app";
import { buatDb } from "./db";
import { env } from "./env";
import { buatMidtrans } from "./pembayaran";

/**
 * App lengkap dari env — dipakai server Bun (`index.ts`) dan route handler
 * Next (`src/lib/api.ts`) supaya keduanya tidak bisa berbeda kabel.
 */
export function rakitApp() {
  /* Tanpa kunci, API tetap jalan tapi pembuatan tagihan menjawab 503.
     Dibiarkan undefined, BUKAN diganti penyedia tiruan: penyedia tiruan di
     produksi akan menandai tagihan lunas tanpa uang yang pernah masuk. */
  const gateway = process.env.MIDTRANS_SERVER_KEY
    ? buatMidtrans(env.midtransServerKey, env.midtransProduksi)
    : undefined;
  if (!gateway) {
    console.warn(
      "MIDTRANS_SERVER_KEY belum diisi — pembuatan tagihan akan dijawab 503.",
    );
  }

  /* Sama seperti gateway: tanpa kredensial, pendaftaran dijawab 503 — bukan
     jatuh ke penyedia tiruan. */
  const akun =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? buatSupabaseAuth(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        )
      : undefined;
  if (!akun) {
    console.warn(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi — pendaftaran akan dijawab 503.",
    );
  }

  return buatApp(
    buatDb(env.databaseUrl),
    gateway,
    process.env.MIDTRANS_SERVER_KEY,
    akun,
  );
}
