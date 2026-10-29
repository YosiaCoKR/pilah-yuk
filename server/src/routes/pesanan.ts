import { and, desc, eq, sql } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { grupBaris, pilihBaris } from "../baris-pesanan";
import { bentrokDengan } from "../galat";
import { kategoriDariSlug } from "../jenis";
import { ringkasLangganan } from "../langganan";
import {
  addresses,
  pickupItems,
  pickups,
  rwChannels,
  timeSlots,
  wasteCategories,
} from "../db/schema";

const BadanPesanan = t.Object({
  addressId: t.String({ format: "uuid" }),
  /* Slug kategori ("organik", "plastik", …) — frontend tidak perlu tahu UUID
     kategori, dan slug-nya stabil lintas lingkungan. */
  jenis: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 4 }),
  tanggal: t.String({ format: "date" }),
  timeSlotId: t.String({ format: "uuid" }),
  catatan: t.Optional(t.String({ maxLength: 200 })),
});

/** Urutan normal sebuah pesanan. "batal" di luar urutan ini. */
const LANGKAH = ["menunggu", "dijemput", "selesai"] as const;

/** PY-#### — pendek, mudah dibacakan lewat telepon ke petugas. */
function buatKode() {
  return `PY-${Math.floor(1000 + Math.random() * 9000)}`;
}

export const rutePesanan = (db: Db) =>
  new Elysia({ prefix: "/pesanan" })
    .use(auth)

    .post(
      "/",
      async ({ penggunaId, body }) => {
        const hariIni = new Date().toISOString().slice(0, 10);
        if (body.tanggal < hariIni) {
          return status(422, {
            pesan: "Tanggal sudah lewat. Pilih hari ini atau sesudahnya.",
          });
        }

        /* Gerbang langganan. UI sudah menonaktifkan tombolnya, tapi aturan
           ini harus ditegakkan di server juga — tombol bisa dilewati. */
        const langganan = await ringkasLangganan(db, penggunaId);
        if (!langganan.bolehPesan) {
          return status(402, {
            pesan: langganan.alasan ?? "Langganan belum aktif.",
            langganan: {
              status: langganan.status,
              pickupUsed: langganan.pickupUsed,
              pickupQuota: langganan.pickupQuota,
            },
          });
        }

        /* Alamat harus milik si pemesan — sekaligus sumber channel yang
           akan menerima pesanan. */
        const [alamat] = await db
          .select({ id: addresses.id, channelId: addresses.rwChannelId })
          .from(addresses)
          .where(
            and(
              eq(addresses.id, body.addressId),
              eq(addresses.userId, penggunaId),
            ),
          );
        if (!alamat) {
          return status(404, { pesan: "Alamat jemput tidak ditemukan." });
        }

        const jenis = await kategoriDariSlug(db, body.jenis);
        if ("galat" in jenis) return status(422, jenis.galat);
        const { unik: slugUnik, kategori } = jenis;

        const [slot] = await db
          .select({ id: timeSlots.id, capacity: timeSlots.capacity })
          .from(timeSlots)
          .where(
            and(eq(timeSlots.id, body.timeSlotId), eq(timeSlots.isActive, true)),
          );
        if (!slot) {
          return status(404, { pesan: "Jam jemput tidak tersedia." });
        }

        try {
          const hasil = await db.transaction(async (tx) => {
            /* Kunci baris slot selama transaksi supaya dua pesanan yang
               datang bersamaan tidak sama-sama lolos cek kuota. */
            await tx.execute(
              sql`select id from ${timeSlots} where id = ${slot.id} for update`,
            );

            const [{ terpakai }] = await tx
              .select({
                terpakai: sql<number>`count(*) filter (
                  where ${pickups.status} <> 'batal'
                )::int`,
              })
              .from(pickups)
              .where(
                and(
                  eq(pickups.pickupDate, body.tanggal),
                  eq(pickups.timeSlotId, slot.id),
                  alamat.channelId
                    ? eq(pickups.channelId, alamat.channelId)
                    : undefined,
                ),
              );

            if (terpakai >= slot.capacity) return { penuh: true } as const;

            const [pesanan] = await tx
              .insert(pickups)
              .values({
                code: buatKode(),
                userId: penggunaId,
                addressId: alamat.id,
                channelId: alamat.channelId,
                pickupDate: body.tanggal,
                timeSlotId: slot.id,
                notes: body.catatan?.trim() || null,
              })
              .returning();

            await tx.insert(pickupItems).values(
              kategori.map((k) => ({
                pickupId: pesanan.id,
                categoryId: k.id,
              })),
            );

            return { penuh: false, pesanan } as const;
          });

          if (hasil.penuh) {
            return status(409, {
              pesan: "Kuota jam ini baru saja penuh. Pilih jam lain, ya.",
            });
          }

          return status(201, {
            data: {
              id: hasil.pesanan.id,
              code: hasil.pesanan.code,
              status: hasil.pesanan.status,
              tanggal: hasil.pesanan.pickupDate,
              jenis: slugUnik,
            },
          });
        } catch (e) {
          /* Kode pesanan bentrok — 4 digit acak, jadi sesekali bisa kembar. */
          if (bentrokDengan(e, "pickups_code_idx")) {
            return status(409, {
              pesan: "Kode pesanan bentrok. Coba kirim sekali lagi.",
            });
          }
          throw e;
        }
      },
      { body: BadanPesanan },
    )

    /* Bentuk baris dipakai bersama daftar dan detail supaya keduanya tidak
       pelan-pelan jadi berbeda. */
    .get(
      "/",
      async ({ penggunaId, query }) => {
      const baris = await pilihBaris(db)
        .where(
          and(
            eq(pickups.userId, penggunaId),
            query.status ? eq(pickups.status, query.status) : undefined,
          ),
        )
        .groupBy(...grupBaris)
        .orderBy(desc(pickups.pickupDate), desc(pickups.createdAt));

      return { data: baris };
      },
      {
        query: t.Object({
          status: t.Optional(
            t.Union([
              t.Literal("menunggu"),
              t.Literal("dijemput"),
              t.Literal("selesai"),
              t.Literal("batal"),
            ]),
          ),
        }),
      },
    )

    .get(
      "/:id",
      async ({ penggunaId, params }) => {
        const [pesanan] = await db
          .select({
            id: pickups.id,
            code: pickups.code,
            status: pickups.status,
            tanggal: pickups.pickupDate,
            jam: timeSlots.label,
            jamMulai: timeSlots.startTime,
            totalWeightKg: pickups.totalWeightKg,
            officerName: pickups.officerName,
            proofUrl: pickups.proofUrl,
            notes: pickups.notes,
            dibuatPada: pickups.createdAt,
            diperbaruiPada: pickups.updatedAt,
            alamatId: addresses.id,
            alamatLabel: addresses.label,
            alamatLengkap: addresses.fullAddress,
            alamatPatokan: addresses.landmark,
            channelName: rwChannels.name,
            jenis: sql<string[]>`coalesce(
              array_agg(${wasteCategories.slug}) filter (
                where ${wasteCategories.slug} is not null
              ), '{}'
            )`,
          })
          .from(pickups)
          .innerJoin(addresses, eq(pickups.addressId, addresses.id))
          .leftJoin(timeSlots, eq(pickups.timeSlotId, timeSlots.id))
          .leftJoin(rwChannels, eq(pickups.channelId, rwChannels.id))
          .leftJoin(pickupItems, eq(pickupItems.pickupId, pickups.id))
          .leftJoin(
            wasteCategories,
            eq(pickupItems.categoryId, wasteCategories.id),
          )
          /* userId di WHERE: pesanan warga lain dijawab 404, bukan 403 —
             keberadaannya pun tidak perlu bocor. */
          .where(
            and(eq(pickups.id, params.id), eq(pickups.userId, penggunaId)),
          )
          .groupBy(pickups.id, addresses.id, timeSlots.id, rwChannels.id);

        if (!pesanan) return status(404, { pesan: "Pesanan tidak ditemukan." });

        /* "Pak Dedi sudah 8 kali mengangkut di sini" — dihitung di server
           karena layar hanya memegang satu pesanan, bukan seluruh riwayat.
           Dibatasi alamat yang sama: yang membangun kepercayaan adalah petugas
           yang datang ke rumah ITU, bukan jumlah angkut se-kota. */
        const [angkut] = pesanan.officerName
          ? await db
              .select({ jumlah: sql<number>`count(*)::int` })
              .from(pickups)
              .where(
                and(
                  eq(pickups.userId, penggunaId),
                  eq(pickups.addressId, pesanan.alamatId),
                  eq(pickups.officerName, pesanan.officerName),
                  eq(pickups.status, "selesai"),
                ),
              )
          : [{ jumlah: 0 }];

        return {
          data: {
            ...pesanan,
            petugasJumlahAngkut: angkut.jumlah,
            /* Langkah yang sudah dilalui, supaya frontend tidak perlu
               menebak urutannya sendiri. */
            lini: LANGKAH.map((langkah) => ({
              langkah,
              lewat:
                pesanan.status === "batal"
                  ? false
                  : LANGKAH.indexOf(langkah) <= LANGKAH.indexOf(pesanan.status),
              kini: langkah === pesanan.status,
            })),
            bisaDibatalkan: pesanan.status === "menunggu",
          },
        };
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    )

    .put(
      "/:id/batal",
      async ({ penggunaId, params }) => {
        const [pesanan] = await db
          .select({ status: pickups.status })
          .from(pickups)
          .where(
            and(eq(pickups.id, params.id), eq(pickups.userId, penggunaId)),
          );

        if (!pesanan) return status(404, { pesan: "Pesanan tidak ditemukan." });

        /* Sekali petugas berangkat, pembatalan lewat aplikasi tidak lagi
           mencerminkan kenyataan di lapangan. */
        if (pesanan.status !== "menunggu") {
          return status(409, {
            pesan:
              pesanan.status === "batal"
                ? "Pesanan ini sudah dibatalkan."
                : "Petugas sudah berangkat, pesanan tidak bisa dibatalkan.",
          });
        }

        const [batal] = await db
          .update(pickups)
          .set({ status: "batal", updatedAt: new Date() })
          .where(eq(pickups.id, params.id))
          .returning({ id: pickups.id, status: pickups.status });

        return { data: batal };
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    );
