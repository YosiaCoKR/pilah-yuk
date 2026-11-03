import { and, eq, ne } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import type { Db } from "../db";
import { payments, subscriptions } from "../db/schema";
import { artiNotifikasi, tandaTangan, tandaTanganCocok } from "../pembayaran";

/*
  Bentuk notifikasi Midtrans, hanya kolom yang dipakai. Sengaja longgar — ini
  masukan dari luar, dan menolak notifikasi sungguhan karena ada kolom baru di
  sisi Midtrans berarti langganan yang sudah dibayar tidak pernah aktif.
*/
const BadanNotifikasi = t.Object({
  order_id: t.String({ minLength: 1, maxLength: 120 }),
  status_code: t.String({ minLength: 1, maxLength: 10 }),
  gross_amount: t.String({ minLength: 1, maxLength: 32 }),
  signature_key: t.String({ minLength: 1, maxLength: 256 }),
  transaction_status: t.String({ minLength: 1, maxLength: 40 }),
  transaction_id: t.Optional(t.String({ maxLength: 120 })),
  fraud_status: t.Optional(t.String({ maxLength: 40 })),
  status_message: t.Optional(t.String({ maxLength: 500 })),
});

/**
 * Notifikasi pembayaran dari Midtrans.
 *
 * TIDAK memakai `auth`: yang memanggil adalah Midtrans, yang tidak punya
 * identitas warga. Yang menggantikannya adalah tanda tangan di badan
 * permintaan — diperiksa sebelum satu baris pun dibaca dari basis data.
 *
 * Dipasang sebagai instance sendiri, bukan di dalam grup langganan, justru
 * supaya `auth` yang di sana tidak pernah bisa terbawa ke sini — dan supaya
 * jelas dari strukturnya bahwa ini pintu publik.
 */
export const ruteWebhookBayar = (db: Db, serverKey?: string) =>
  new Elysia({ prefix: "/webhook" }).post(
    "/midtrans",
    async ({ body }) => {
      /* Tanpa kunci, tanda tangan tidak bisa diperiksa — dan notifikasi yang
         tidak bisa diperiksa tidak boleh menggerakkan apa pun. */
      if (!serverKey) {
        return status(503, { pesan: "Webhook pembayaran belum tersambung." });
      }

      const sah = tandaTanganCocok(
        body.signature_key,
        tandaTangan(
          body.order_id,
          body.status_code,
          body.gross_amount,
          serverKey,
        ),
      );
      if (!sah) {
        /* Jawaban sependek mungkin: apa pun yang disebut di sini membantu
           penebak berikutnya memperbaiki tebakannya. */
        return status(401, { pesan: "Tanda tangan tidak sah." });
      }

      const [tagihan] = await db
        .select()
        .from(payments)
        .where(eq(payments.code, body.order_id));
      /* Bukan 200: order_id yang tidak dikenal berarti webhook ini menunjuk ke
         lingkungan yang salah, dan itu harus terlihat di dashboard Midtrans
         alih-alih tenggelam sebagai "sukses". */
      if (!tagihan) return status(404, { pesan: "Tagihan tidak dikenal." });

      /* Midtrans mengirim ulang notifikasi yang sama. Yang sudah lunas tidak
         diproses dua kali: periode langganan akan bertambah dua kali dari satu
         kali pembayaran. */
      if (tagihan.status === "paid") {
        return { data: { code: tagihan.code, status: tagihan.status } };
      }

      /*
        HANYA tagihan yang masih `pending` boleh mengaktifkan langganan.

        Penjaganya positif, bukan "selain paid": tagihan yang sudah `expired`
        atau `failed` tetap bisa menerima notifikasi `settlement` — kode QRIS
        yang ditinggalkan warga masih bisa dipindai, dan pembatalan di penyedia
        bisa gagal. Dengan penjaga "selain paid", membayar tagihan paket murah
        yang sudah ditinggalkan akan mengaktifkan baris langganan yang sudah
        ditimpa paket mahal: Rp45.000 dibayar, 16 jemput didapat.

        Uangnya nyata, jadi tidak ditelan diam-diam: sebabnya ditulis di baris
        tagihan supaya pengurus bisa menemukannya dan mengembalikan dananya.
        Dijawab 200 supaya Midtrans berhenti mengirim ulang — tidak ada yang
        bisa diperbaiki dengan mencoba lagi.
      */
      if (tagihan.status !== "pending") {
        const arti = artiNotifikasi(
          body.transaction_status,
          body.fraud_status,
          body.status_message,
        );
        if (arti.jadi === "paid") {
          await db
            .update(payments)
            .set({
              failureReason: `Dibayar setelah tagihan ${tagihan.status} — uang masuk tapi langganan TIDAK diaktifkan. Perlu pengembalian dana.`,
            })
            .where(eq(payments.id, tagihan.id));
          return {
            data: {
              code: tagihan.code,
              status: tagihan.status,
              perluDitinjau: true,
            },
          };
        }
        return { data: { code: tagihan.code, status: tagihan.status } };
      }

      /* Tanda tangan sudah menjamin nominalnya datang dari Midtrans untuk
         order ini. Kalau tetap berbeda dari catatan kita, yang salah ada di
         tempat lain — dan menandai lunas atas jumlah yang tidak kita tagih
         bukan cara menyelesaikannya. */
      if (Math.round(Number(body.gross_amount)) !== tagihan.amount) {
        return status(409, {
          pesan: "Nominal notifikasi tidak cocok dengan tagihan.",
        });
      }

      const arti = artiNotifikasi(
        body.transaction_status,
        body.fraud_status,
        body.status_message,
      );

      if (arti.jadi === "pending") {
        return { data: { code: tagihan.code, status: tagihan.status } };
      }

      if (arti.jadi !== "paid") {
        const [gagal] = await db
          .update(payments)
          .set({ status: arti.jadi, failureReason: arti.sebab })
          .where(eq(payments.id, tagihan.id))
          .returning({ code: payments.code, status: payments.status });
        /* Langganannya dibiarkan menunggu bayar: warga masih bisa mencoba
           lagi dari layar langganan tanpa kehilangan pilihan paketnya. */
        return { data: gagal };
      }

      const hasil = await db.transaction(async (tx) => {
        const [lunas] = await tx
          .update(payments)
          .set({
            status: "paid",
            paidAt: new Date(),
            /* Kunci idempoten. Saat tagihan dibuat lewat API kita, kolom ini
               sudah terisi; notifikasi yang datang untuk tagihan tanpa
               provider_ref (mis. dibuat ulang manual) tetap mengisinya. */
            providerRef: tagihan.providerRef ?? body.transaction_id ?? null,
          })
          .where(eq(payments.id, tagihan.id))
          .returning();

        const [langganan] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, tagihan.subscriptionId));

        if (langganan) {
          /* Perpanjangan: barisnya sudah aktif, yang bergerak hanya tanggal
             berakhirnya — persis periode yang dibayar tagihan ini. */
          if (langganan.status === "aktif") {
            await tx
              .update(subscriptions)
              .set({
                /* planId ikut disetel walau biasanya sama: yang berlaku harus
                   paket yang DIBAYAR tagihan ini, bukan paket yang kebetulan
                   tercatat di baris langganan. */
                planId: lunas.planId,
                endDate: lunas.periodEnd,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.id, langganan.id));
          } else {
            /* Paket baru atau ganti paket. Yang lama DITURUNKAN lebih dulu di
               transaksi yang sama: satu langganan aktif per warga, jadi
               mempromosikan dulu akan ditolak index-nya. */
            await tx
              .update(subscriptions)
              .set({ status: "kedaluwarsa", updatedAt: new Date() })
              .where(
                and(
                  eq(subscriptions.userId, lunas.userId),
                  eq(subscriptions.status, "aktif"),
                  ne(subscriptions.id, langganan.id),
                ),
              );
            await tx
              .update(subscriptions)
              .set({
                status: "aktif",
                /* Dari tagihan, bukan dari baris langganan: barisnya ditimpa
                   tiap warga memilih paket lain, jadi ia bisa menunjuk paket
                   yang tidak dibayar tagihan ini. */
                planId: lunas.planId,
                startDate: lunas.periodStart,
                endDate: lunas.periodEnd,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.id, langganan.id));
          }
        }

        return { code: lunas.code, status: lunas.status };
      });

      return { data: hasil };
    },
    { body: BadanNotifikasi },
  );
