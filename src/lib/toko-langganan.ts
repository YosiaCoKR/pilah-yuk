import { kirim } from "./kirim";

/** Metode bayar seperti yang diterima `POST /api/langganan/bayar`. */
export type MetodeBayar = "qris" | "ewallet" | "va_bank";

/** Hasil membuat tagihan: cara membayarnya sesuai metode. */
export type TagihanBaru = {
  id: string;
  code: string;
  amount: number;
  planName: string;
  qrUrl?: string;
  vaNumber?: string;
  deeplink?: string;
};

/**
 * Buat tagihan untuk satu paket. Server sekaligus mencatat langganan
 * "menunggu bayar" (atau perpanjangan); aktifnya menunggu webhook Midtrans.
 */
export const bayarPaket = (
  planId: string,
  method: MetodeBayar,
  channel?: string,
) =>
  kirim<TagihanBaru>("POST", "/api/langganan/bayar", {
    planId,
    method,
    channel,
  });

export const setelPerpanjangOtomatis = (aktif: boolean) =>
  kirim("PUT", "/api/langganan/perpanjang-otomatis", { aktif });
