import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Penyedia pembayaran: Midtrans Core API.
 *
 * Dipisah dari rute dengan alasan yang sama seperti `pengingat.ts` — perakitan
 * permintaan dan pembacaan jawaban bisa diperiksa tanpa memanggil siapa pun,
 * dan rute tidak perlu tahu bentuk JSON Midtrans.
 *
 * Core API dipakai, bukan Snap: layar bayar warga sudah punya pilihan metode
 * dan kanalnya sendiri, dan Snap akan menggantinya dengan halaman pilihan
 * milik Midtrans.
 */

export type PermintaanBayar = {
  /** `code` tagihan kita, dipakai sebagai `order_id` di Midtrans. */
  code: string;
  amount: number;
  method: "qris" | "ewallet" | "va_bank";
  /** "GoPay", "BCA", … null untuk QRIS. */
  channel: string | null;
};

export type HasilBayar = {
  /** `transaction_id` Midtrans — disimpan sebagai kunci idempoten webhook. */
  providerRef: string;
  /** Satu di antaranya terisi, sesuai metodenya. */
  qrUrl: string | null;
  vaNumber: string | null;
  deeplink: string | null;
};

/**
 * Penyedia pembayaran punya dua kerja, bukan satu: menagih, dan MEMATIKAN
 * tagihan yang ditinggalkan. Tanpa yang kedua, kode QRIS dari paket yang sudah
 * tidak dipilih warga tetap bisa dibayar — dan uangnya masuk untuk tagihan
 * yang tidak lagi berlaku.
 */
export type Gateway = {
  tagih: (p: PermintaanBayar) => Promise<HasilBayar>;
  /**
   * Matikan tagihan di sisi penyedia. `false` = tidak bisa dimatikan (sudah
   * tuntas atau kedaluwarsa di sana), yang bukan kegagalan — tapi pemanggil
   * perlu tahu bedanya dengan "berhasil dimatikan".
   */
  batalkan: (code: string) => Promise<boolean>;
};

/** Ditolak penyedia, atau kanalnya tidak dilayani Core API. */
export class GalatBayar extends Error {
  constructor(
    readonly pesan: string,
    /** true = salah pilihan warga (422), false = penyedia bermasalah (502). */
    readonly salahPilihan = false,
  ) {
    super(pesan);
  }
}

/*
  Kanal yang BENAR-BENAR dilayani Midtrans Core API, bukan yang tampil di
  layar. Tiga di antara pilihan layar tidak punya jalur langsung di Core API:

  - Mandiri lewat `echannel` (Mandiri Bill), yang menjawab bill_key + biller_code
    dan bukan nomor virtual account — bentuk yang berbeda, dan layar bayar
    belum punya tempat untuk dua angka itu.
  - OVO dan DANA tidak punya payment_type Core API; keduanya dibayar dengan
    memindai QRIS.

  Yang tidak terdaftar DITOLAK, tidak dialihkan diam-diam ke metode lain:
  warga yang menekan "DANA" lalu menerima nomor VA bank akan menganggap
  aplikasinya rusak.
*/
const BANK: Record<string, string> = {
  bca: "bca",
  bni: "bni",
  bri: "bri",
  cimb: "cimb",
};
const EWALLET: Record<string, string> = {
  gopay: "gopay",
  shopeepay: "shopeepay",
};

/** Badan permintaan `POST /v2/charge`. Murni — tidak memanggil apa pun. */
export function badanCharge(p: PermintaanBayar): Record<string, unknown> {
  const transaction_details = {
    order_id: p.code,
    /* Rupiah penuh. Midtrans menolak gross_amount berdesimal untuk IDR. */
    gross_amount: p.amount,
  };
  const kanal = p.channel?.toLowerCase().replace(/\s+/g, "") ?? "";

  if (p.method === "qris") {
    return { payment_type: "qris", transaction_details, qris: { acquirer: "gopay" } };
  }

  if (p.method === "ewallet") {
    const jenis = EWALLET[kanal];
    if (!jenis) {
      throw new GalatBayar(
        `${p.channel} belum bisa dibayar langsung. Pilih QRIS, lalu pindai dari aplikasi ${p.channel}.`,
        true,
      );
    }
    return { payment_type: jenis, transaction_details };
  }

  /* Permata punya payment_type sendiri dan tidak menerima objek
     bank_transfer — jawabannya pun memakai nama kolom yang lain. */
  if (kanal === "permata") {
    return { payment_type: "permata", transaction_details };
  }

  const bank = BANK[kanal];
  if (!bank) {
    throw new GalatBayar(
      `Transfer ${p.channel} belum dilayani. Pilih BCA, BNI, BRI, atau CIMB.`,
      true,
    );
  }
  return { payment_type: "bank_transfer", transaction_details, bank_transfer: { bank } };
}

type Jawaban = {
  status_code?: string;
  status_message?: string;
  transaction_id?: string;
  transaction_status?: string;
  va_numbers?: { bank: string; va_number: string }[];
  permata_va_number?: string;
  actions?: { name: string; url: string }[];
};

/**
 * Membaca jawaban Midtrans jadi bentuk yang dibaca layar.
 *
 * Yang diperiksa lebih dulu adalah statusnya, bukan ada-tidaknya nomor VA:
 * transaksi yang ditolak (`deny`) tetap menjawab 20x dengan badan lengkap,
 * jadi hanya membaca nomornya akan membuat tagihan yang ditolak terlihat
 * seperti tagihan yang siap dibayar.
 */
export function bacaJawaban(j: Jawaban): HasilBayar {
  const status = j.transaction_status;
  if (status && status !== "pending") {
    throw new GalatBayar(
      j.status_message ?? `Pembayaran ditolak penyedia (${status}).`,
    );
  }
  if (!j.transaction_id) {
    throw new GalatBayar("Penyedia tidak mengembalikan id transaksi.");
  }

  const aksi = (nama: string) =>
    j.actions?.find((a) => a.name === nama)?.url ?? null;

  return {
    providerRef: j.transaction_id,
    qrUrl: aksi("generate-qr-code"),
    vaNumber: j.va_numbers?.[0]?.va_number ?? j.permata_va_number ?? null,
    deeplink: aksi("deeplink-redirect"),
  };
}

/**
 * Gateway sungguhan.
 *
 * `order_id` memakai kode tagihan kita, jadi percobaan yang dikirim dua kali
 * ditolak Midtrans sebagai order_id kembar — bukan jadi dua transaksi untuk
 * satu tagihan.
 */
export function buatMidtrans(serverKey: string, produksi: boolean): Gateway {
  const dasar = produksi
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
  /* Server key + ":" (sandi kosong), persis seperti yang diminta dokumennya. */
  const izin = `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
  const kepala = {
    accept: "application/json",
    "content-type": "application/json",
    authorization: izin,
  };

  const tagih = async (p: PermintaanBayar) => {
    let res: Response;
    try {
      res = await fetch(`${dasar}/v2/charge`, {
        method: "POST",
        headers: kepala,
        body: JSON.stringify(badanCharge(p)),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      /* Jaringan/timeout. Pesannya tidak diteruskan ke warga — isinya nama
         host dan jejak internal. */
      throw new GalatBayar(
        e instanceof Error && e.name === "TimeoutError"
          ? "Penyedia pembayaran tidak menjawab. Coba sebentar lagi."
          : "Gagal menghubungi penyedia pembayaran. Coba sebentar lagi.",
      );
    }

    const jawaban = (await res.json().catch(() => ({}))) as Jawaban;
    /* Midtrans memakai status_code di badan, bukan hanya status HTTP. 201 =
       transaksi terbentuk; 200 dipakai untuk yang langsung tuntas. */
    if (!res.ok || !["200", "201"].includes(jawaban.status_code ?? "")) {
      throw new GalatBayar(
        jawaban.status_message ?? "Penyedia pembayaran menolak tagihan ini.",
      );
    }
    return bacaJawaban(jawaban);
  };

  /**
   * `POST /v2/{order_id}/cancel` — membatalkan tagihan yang belum dibayar.
   *
   * status_code 412 ("Merchant cannot modify the status of the transaction")
   * bukan galat: artinya tagihannya sudah tuntas atau sudah kedaluwarsa di
   * sisi Midtrans, jadi memang tidak ada lagi yang perlu dimatikan.
   */
  const batalkan = async (code: string) => {
    const res = await fetch(`${dasar}/v2/${encodeURIComponent(code)}/cancel`, {
      method: "POST",
      headers: kepala,
      signal: AbortSignal.timeout(10_000),
    });
    const jawaban = (await res.json().catch(() => ({}))) as Jawaban;
    if (jawaban.status_code === "200") return true;
    if (["412", "404"].includes(jawaban.status_code ?? "")) return false;
    throw new GalatBayar(
      jawaban.status_message ?? "Gagal membatalkan tagihan di penyedia.",
    );
  };

  return { tagih, batalkan };
}

/* --- webhook ------------------------------------------------------------- */

/**
 * Tanda tangan notifikasi Midtrans: SHA512(order_id + status_code +
 * gross_amount + ServerKey), tanpa pemisah.
 *
 * Ini SATU-SATUNYA yang membedakan notifikasi dari Midtrans dengan satu baris
 * curl dari siapa pun. Tanpa pemeriksaan ini, alamat webhook-nya adalah tombol
 * "tandai langganan saya lunas" yang terbuka di internet.
 */
export function tandaTangan(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
}

/** Banding tanpa membocorkan posisi karakter yang berbeda lewat lama waktu. */
export function tandaTanganCocok(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  /* timingSafeEqual menolak panjang berbeda dengan melempar, dan panjang
     hash-nya memang tetap — jadi beda panjang langsung tidak cocok. */
  return x.length === y.length && timingSafeEqual(x, y);
}

export type ArtiNotifikasi =
  | { jadi: "paid" }
  | { jadi: "pending" }
  | { jadi: "failed" | "expired"; sebab: string };

/**
 * Arti `transaction_status` bagi tagihan kita.
 *
 * `capture` hanya dianggap lunas kalau `fraud_status`-nya `accept`: itu jalur
 * kartu, dan FDS Midtrans bisa menolaknya setelah dananya tertahan. Metode
 * seperti Indomaret tidak mengirim `fraud_status` sama sekali, jadi
 * ketidakhadirannya bukan penolakan.
 */
export function artiNotifikasi(
  transactionStatus: string,
  fraudStatus?: string,
  pesan?: string,
): ArtiNotifikasi {
  const sebab = pesan?.trim() || "Pembayaran tidak berhasil.";

  if (transactionStatus === "settlement") return { jadi: "paid" };
  if (transactionStatus === "capture") {
    return fraudStatus && fraudStatus !== "accept"
      ? { jadi: "failed", sebab: "Pembayaran ditolak pemeriksaan penipuan." }
      : { jadi: "paid" };
  }
  if (transactionStatus === "expire") {
    return { jadi: "expired", sebab: "Waktu pembayaran habis." };
  }
  if (["deny", "cancel", "failure"].includes(transactionStatus)) {
    return { jadi: "failed", sebab };
  }
  /* pending, authorize, refund, partial_refund: belum/bukan keputusan yang
     boleh menggerakkan langganan dari sini. Pengembalian dana diurus manual
     oleh pengurus — mencabut kuota jemput otomatis saat warga sudah membuang
     sampahnya bukan keputusan yang pantas diambil sebuah webhook. */
  return { jadi: "pending" };
}
