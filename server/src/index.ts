import { buatApp } from "./app";
import { buatDb } from "./db";
import { env } from "./env";
import { buatMidtrans } from "./pembayaran";

/* Tanpa kunci, API tetap jalan tapi pembuatan tagihan menjawab 503. Dibiarkan
   undefined, BUKAN diganti penyedia tiruan: penyedia tiruan di produksi akan
   menandai tagihan lunas tanpa uang yang pernah masuk. */
const gateway = process.env.MIDTRANS_SERVER_KEY
  ? buatMidtrans(env.midtransServerKey, env.midtransProduksi)
  : undefined;
if (!gateway) {
  console.warn(
    "MIDTRANS_SERVER_KEY belum diisi — pembuatan tagihan akan dijawab 503.",
  );
}

buatApp(buatDb(env.databaseUrl), gateway, process.env.MIDTRANS_SERVER_KEY).listen(env.port, ({ hostname, port }) => {
  console.log(`Pilah Yuk API jalan di http://${hostname}:${port}`);
});
