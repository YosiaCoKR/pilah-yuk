import { and, asc, ilike, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { faqs } from "../db/schema";
import { kawalPola } from "./panduan";

export const ruteBantuan = (db: Db) =>
  new Elysia({ prefix: "/bantuan" })
    .use(auth)

    /**
     * FAQ Pusat Bantuan. Tanpa `kata` → semua, urut tampil. Dengan `kata` →
     * SETIAP kata kunci harus muncul di topik, pertanyaan, atau jawaban:
     * "bayar qris" menyempit ke jawaban soal QRIS, bukan melebar ke semua
     * yang menyebut "bayar". Aturan yang sama dengan pencarian di layar.
     *
     * ponytail: ilike tanpa indeks — daftarnya puluhan baris. Pindah ke
     * full-text search kalau FAQ sampai ribuan.
     */
    .get(
      "/",
      async ({ query }) => {
        const kunci = (query.kata ?? "").split(/\s+/).filter(Boolean);
        const data = await db
          .select({
            id: faqs.id,
            topik: faqs.topic,
            tanya: faqs.question,
            jawab: faqs.answer,
          })
          .from(faqs)
          .where(
            and(
              ...kunci.map((k) => {
                const pola = kawalPola(k);
                return or(
                  ilike(faqs.topic, pola),
                  ilike(faqs.question, pola),
                  ilike(faqs.answer, pola),
                );
              }),
            ),
          )
          .orderBy(asc(faqs.sortOrder));
        return { data };
      },
      {
        query: t.Object({ kata: t.Optional(t.String({ maxLength: 60 })) }),
      },
    );
