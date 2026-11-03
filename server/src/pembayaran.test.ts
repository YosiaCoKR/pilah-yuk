/**
 * Perakitan permintaan & pembacaan jawaban Midtrans.
 *
 * Contoh JSON di bawah DISALIN dari dokumen Midtrans Core API, bukan
 * dikarang: bentuk jawaban VA berbeda antara BCA (`va_numbers[]`) dan Permata
 * (`permata_va_number`), dan itu beda yang paling mudah salah diingat.
 *
 * Jalankan: npm run test:bayar
 */
import assert from "node:assert/strict";
import { GalatBayar, bacaJawaban, badanCharge } from "./pembayaran";
import { lulus } from "./test/bantu";

const dasar = { code: "PY-INV-4712", amount: 45_000 } as const;

/* --- badan permintaan --- */
assert.deepEqual(
  badanCharge({ ...dasar, method: "qris", channel: null }),
  {
    payment_type: "qris",
    transaction_details: { order_id: "PY-INV-4712", gross_amount: 45_000 },
    qris: { acquirer: "gopay" },
  },
);
/* order_id = kode tagihan kita: percobaan yang terkirim dua kali ditolak
   Midtrans sebagai order_id kembar, bukan jadi dua transaksi. */
assert.equal(
  (badanCharge({ ...dasar, method: "qris", channel: null })
    .transaction_details as { order_id: string }).order_id,
  dasar.code,
);
lulus("qris: payment_type qris, order_id = kode tagihan");

assert.deepEqual(badanCharge({ ...dasar, method: "va_bank", channel: "BCA" }), {
  payment_type: "bank_transfer",
  transaction_details: { order_id: "PY-INV-4712", gross_amount: 45_000 },
  bank_transfer: { bank: "bca" },
});
/* Permata tidak menerima objek bank_transfer — payment_type-nya sendiri. */
assert.deepEqual(
  badanCharge({ ...dasar, method: "va_bank", channel: "Permata" }),
  {
    payment_type: "permata",
    transaction_details: { order_id: "PY-INV-4712", gross_amount: 45_000 },
  },
);
assert.deepEqual(
  badanCharge({ ...dasar, method: "ewallet", channel: "GoPay" }),
  {
    payment_type: "gopay",
    transaction_details: { order_id: "PY-INV-4712", gross_amount: 45_000 },
  },
);
lulus("va bank & e-wallet: bca, permata, gopay terpetakan benar");

/* Kanal yang tidak dilayani Core API ditolak, TIDAK dialihkan diam-diam:
   warga yang menekan "DANA" lalu menerima nomor VA bank akan menganggap
   aplikasinya rusak. */
for (const [method, channel] of [
  ["ewallet", "DANA"],
  ["ewallet", "OVO"],
  ["va_bank", "Mandiri"],
] as const) {
  assert.throws(
    () => badanCharge({ ...dasar, method, channel }),
    (e: unknown) => e instanceof GalatBayar && e.salahPilihan,
    `${channel} harus ditolak sebagai salah pilihan, bukan dialihkan`,
  );
}
lulus("DANA, OVO, Mandiri → ditolak sebagai salah pilihan (bukan dialihkan)");

/* --- jawaban: contoh dari dokumen Midtrans --- */
assert.deepEqual(
  bacaJawaban({
    status_code: "201",
    status_message: "Success, Bank Transfer transaction is created",
    transaction_id: "be03df7d-2f97-4c8c-a53c-8959f1b67295",
    transaction_status: "pending",
    va_numbers: [{ bank: "bca", va_number: "812785002530231" }],
  }),
  {
    providerRef: "be03df7d-2f97-4c8c-a53c-8959f1b67295",
    qrUrl: null,
    vaNumber: "812785002530231",
    deeplink: null,
  },
);
assert.equal(
  bacaJawaban({
    status_code: "201",
    transaction_id: "035ca76c-b814-4264-9e63-68142351df83",
    transaction_status: "pending",
    permata_va_number: "850003072869607",
  }).vaNumber,
  "850003072869607",
  "Permata mengembalikan nomornya di kolom lain, bukan di va_numbers[]",
);
lulus("jawaban VA: va_numbers[] (BCA) dan permata_va_number terbaca dua-duanya");

assert.equal(
  bacaJawaban({
    status_code: "201",
    transaction_id: "0d8178e1-c6c7-4ab4-81a6-893be9d924ab",
    transaction_status: "pending",
    actions: [
      {
        name: "generate-qr-code",
        url: "https://api.midtrans.com/v2/qris/0d8178e1/qr-code",
      },
      {
        name: "generate-qr-code-v2",
        url: "https://api.midtrans.com/v4/qris/A1202/qr-code",
      },
    ],
  }).qrUrl,
  "https://api.midtrans.com/v2/qris/0d8178e1/qr-code",
  "diambil generate-qr-code, bukan versi mana pun yang kebetulan pertama",
);
lulus("jawaban QRIS: url generate-qr-code terbaca");

/* Transaksi yang DITOLAK tetap dijawab dengan badan lengkap. Hanya membaca
   nomornya akan membuat tagihan yang ditolak terlihat siap dibayar. */
assert.throws(
  () =>
    bacaJawaban({
      status_code: "201",
      status_message: "Transaction is denied",
      transaction_id: "abc",
      transaction_status: "deny",
      va_numbers: [{ bank: "bca", va_number: "812785002530231" }],
    }),
  (e: unknown) => e instanceof GalatBayar && !e.salahPilihan,
  "status deny harus jadi galat walau nomor VA-nya ada",
);
assert.throws(
  () => bacaJawaban({ status_code: "201", transaction_status: "pending" }),
  GalatBayar,
  "tanpa transaction_id tidak ada kunci idempoten webhook",
);
lulus("status deny & tanpa transaction_id → galat, bukan tagihan siap bayar");

console.log("\nSemua pemeriksaan penyedia pembayaran lulus.");
