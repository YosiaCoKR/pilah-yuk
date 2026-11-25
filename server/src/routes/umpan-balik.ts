import { and, desc, eq, isNull } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { feedbacks, pickups } from "../db/schema";
import { bentrokDengan } from "../galat";

const BadanUlasan = t.Object({
  pickupId: t.String({ format: "uuid" }),
  rating: t.Integer({ minimum: 1, maximum: 5 }),
  tags: t.Optional(
    t.Array(t.String({ minLength: 1, maxLength: 40 }), { maxItems: 8 }),
  ),
  comment: t.Optional(t.String({ maxLength: 500 })),
});

export const ruteUmpanBalik = (db: Db) =>
  new Elysia({ prefix: "/umpan-balik" })
    .use(auth)

    /**
     * Dua daftar untuk layar "Penilaianku": jemput selesai yang belum
     * dinilai (terbaru dulu), dan penilaian yang sudah terkirim.
     */
    .get("/", async ({ penggunaId }) => {
      const pickup = {
        pickupId: pickups.id,
        code: pickups.code,
        pickupDate: pickups.pickupDate,
        officerName: pickups.officerName,
      };
      const [menunggu, terkirim] = await Promise.all([
        db
          .select(pickup)
          .from(pickups)
          .leftJoin(feedbacks, eq(feedbacks.pickupId, pickups.id))
          .where(
            and(
              eq(pickups.userId, penggunaId),
              eq(pickups.status, "selesai"),
              isNull(feedbacks.id),
            ),
          )
          .orderBy(desc(pickups.pickupDate)),
        db
          .select({
            ...pickup,
            rating: feedbacks.rating,
            tags: feedbacks.tags,
            comment: feedbacks.comment,
            createdAt: feedbacks.createdAt,
          })
          .from(feedbacks)
          .innerJoin(pickups, eq(pickups.id, feedbacks.pickupId))
          .where(eq(feedbacks.userId, penggunaId))
          .orderBy(desc(feedbacks.createdAt)),
      ]);
      return { data: { menunggu, terkirim } };
    })

    .post(
      "/",
      async ({ penggunaId, body }) => {
        /* Hanya jemput milik sendiri yang sudah selesai. Milik orang lain
           dijawab 404 — sama seperti tidak ada — supaya tidak membocorkan
           keberadaannya. */
        const [p] = await db
          .select({ status: pickups.status })
          .from(pickups)
          .where(
            and(eq(pickups.id, body.pickupId), eq(pickups.userId, penggunaId)),
          );
        if (!p) return status(404, { pesan: "Penjemputan tidak ditemukan." });
        if (p.status !== "selesai")
          return status(409, {
            pesan: "Penjemputan ini belum selesai, jadi belum bisa dinilai.",
          });

        try {
          const [baru] = await db
            .insert(feedbacks)
            .values({
              userId: penggunaId,
              pickupId: body.pickupId,
              rating: body.rating,
              tags: [...new Set((body.tags ?? []).map((x) => x.trim()))],
              comment: body.comment?.trim() || null,
            })
            .returning();
          return status(201, { data: baru });
        } catch (e) {
          /* Unique index di DB, bukan cek-lalu-tulis: dua ketukan bersamaan
             tidak bisa sama-sama lolos. */
          if (bentrokDengan(e, "feedbacks_satu_per_pickup_idx"))
            return status(409, {
              pesan: "Penjemputan ini sudah kamu nilai.",
            });
          throw e;
        }
      },
      { body: BadanUlasan },
    );
