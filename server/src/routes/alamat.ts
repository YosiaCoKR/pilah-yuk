import { and, desc, eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { addresses, rwChannels } from "../db/schema";

const BadanAlamat = t.Object({
  label: t.String({ minLength: 1, maxLength: 24 }),
  fullAddress: t.String({ minLength: 10, maxLength: 300 }),
  landmark: t.Optional(t.String({ maxLength: 200 })),
  rwChannelId: t.Optional(t.String({ format: "uuid" })),
  isDefault: t.Optional(t.Boolean()),
});

const ParamId = t.Object({ id: t.String({ format: "uuid" }) });

/** Bentuk yang dikirim ke frontend — sejajar dengan tipe `Address` di web. */
const pilihan = {
  id: addresses.id,
  label: addresses.label,
  fullAddress: addresses.fullAddress,
  landmark: addresses.landmark,
  isDefault: addresses.isDefault,
  rwChannelId: addresses.rwChannelId,
  rwChannelName: rwChannels.name,
};

export const ruteAlamat = (db: Db) =>
  new Elysia({ prefix: "/alamat" })
    .use(auth)

    .get("/", async ({ penggunaId }) => {
      const baris = await db
        .select(pilihan)
        .from(addresses)
        .leftJoin(rwChannels, eq(addresses.rwChannelId, rwChannels.id))
        .where(eq(addresses.userId, penggunaId))
        // Alamat utama selalu di atas, sisanya yang terbaru dulu.
        .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));

      return { data: baris };
    })

    .post(
      "/",
      async ({ penggunaId, body }) => {
        const baru = await db.transaction(async (tx) => {
          /* Partial unique index menjamin hanya satu alamat utama per warga,
             jadi yang lama harus diturunkan dulu sebelum yang baru naik —
             kalau tidak, insert-nya ditolak database. */
          if (body.isDefault) {
            await tx
              .update(addresses)
              .set({ isDefault: false })
              .where(eq(addresses.userId, penggunaId));
          }

          const [row] = await tx
            .insert(addresses)
            .values({
              userId: penggunaId,
              label: body.label.trim(),
              fullAddress: body.fullAddress.trim(),
              landmark: body.landmark?.trim() || null,
              rwChannelId: body.rwChannelId ?? null,
              isDefault: body.isDefault ?? false,
            })
            .returning();
          return row;
        });

        return status(201, { data: baru });
      },
      { body: BadanAlamat },
    )

    .patch(
      "/:id",
      async ({ penggunaId, params, body }) => {
        const terubah = await db.transaction(async (tx) => {
          if (body.isDefault) {
            await tx
              .update(addresses)
              .set({ isDefault: false })
              .where(eq(addresses.userId, penggunaId));
          }

          const [row] = await tx
            .update(addresses)
            .set({
              ...(body.label !== undefined && { label: body.label.trim() }),
              ...(body.fullAddress !== undefined && {
                fullAddress: body.fullAddress.trim(),
              }),
              ...(body.landmark !== undefined && {
                landmark: body.landmark.trim() || null,
              }),
              ...(body.rwChannelId !== undefined && {
                rwChannelId: body.rwChannelId,
              }),
              ...(body.isDefault !== undefined && {
                isDefault: body.isDefault,
              }),
            })
            // userId ikut di WHERE: warga tidak bisa menyentuh alamat orang lain.
            .where(
              and(
                eq(addresses.id, params.id),
                eq(addresses.userId, penggunaId),
              ),
            )
            .returning();
          return row;
        });

        if (!terubah) return status(404, { pesan: "Alamat tidak ditemukan." });
        return { data: terubah };
      },
      { params: ParamId, body: t.Partial(BadanAlamat) },
    )

    .put(
      "/:id/utama",
      async ({ penggunaId, params }) => {
        const naik = await db.transaction(async (tx) => {
          /* Periksa kepemilikan sebelum menulis apa pun. Kalau diurutkan
             terbalik, alamat utama lama sudah terlanjur turun dan kita harus
             rollback — rollback sebagai alur normal keluar jadi 500. */
          const [milik] = await tx
            .select({ id: addresses.id })
            .from(addresses)
            .where(
              and(
                eq(addresses.id, params.id),
                eq(addresses.userId, penggunaId),
              ),
            );
          if (!milik) return null;

          /* Turunkan dulu yang lama: partial unique index tidak mengizinkan
             dua alamat utama ada bersamaan, walau cuma sesaat. */
          await tx
            .update(addresses)
            .set({ isDefault: false })
            .where(eq(addresses.userId, penggunaId));

          const [row] = await tx
            .update(addresses)
            .set({ isDefault: true })
            .where(eq(addresses.id, params.id))
            .returning();
          return row;
        });

        if (!naik) return status(404, { pesan: "Alamat tidak ditemukan." });
        return { data: naik };
      },
      { params: ParamId },
    )

    .delete(
      "/:id",
      async ({ penggunaId, params }) => {
        const [terhapus] = await db
          .delete(addresses)
          .where(
            and(eq(addresses.id, params.id), eq(addresses.userId, penggunaId)),
          )
          .returning({ id: addresses.id });

        if (!terhapus) return status(404, { pesan: "Alamat tidak ditemukan." });
        return { data: terhapus };
      },
      { params: ParamId },
    );
