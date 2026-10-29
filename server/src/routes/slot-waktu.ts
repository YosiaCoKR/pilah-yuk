import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { pickups, timeSlots } from "../db/schema";

const Kueri = t.Object({
  tanggal: t.String({ format: "date" }),
  channelId: t.Optional(t.String({ format: "uuid" })),
});

export const ruteSlotWaktu = (db: Db) =>
  new Elysia({ prefix: "/slot-waktu" }).use(auth).get(
    "/",
    async ({ query }) => {
      const { tanggal, channelId } = query;

      /* Jemput tidak bisa dipesan untuk hari yang sudah lewat. Dibandingkan
         sebagai string karena keduanya ISO yyyy-mm-dd. */
      const hariIni = new Date().toISOString().slice(0, 10);
      if (tanggal < hariIni) {
        return status(422, {
          pesan: "Tanggal sudah lewat. Pilih hari ini atau sesudahnya.",
        });
      }

      /* Slot milik channel ini, ditambah slot umum (channel_id NULL). */
      const cakupanSlot = channelId
        ? or(isNull(timeSlots.channelId), eq(timeSlots.channelId, channelId))
        : isNull(timeSlots.channelId);

      const baris = await db
        .select({
          id: timeSlots.id,
          label: timeSlots.label,
          note: timeSlots.note,
          capacity: timeSlots.capacity,
          startTime: timeSlots.startTime,
          /* Pesanan batal tidak memakan kuota. */
          terpakai: sql<number>`count(${pickups.id}) filter (
            where ${pickups.status} <> 'batal'
          )::int`,
        })
        .from(timeSlots)
        .leftJoin(
          pickups,
          and(
            eq(pickups.timeSlotId, timeSlots.id),
            eq(pickups.pickupDate, tanggal),
            channelId ? eq(pickups.channelId, channelId) : undefined,
          ),
        )
        .where(and(eq(timeSlots.isActive, true), cakupanSlot))
        .groupBy(timeSlots.id)
        .orderBy(asc(timeSlots.sortOrder), asc(timeSlots.startTime));

      const data = baris.map((s) => {
        const sisaKuota = Math.max(0, s.capacity - s.terpakai);
        return {
          id: s.id,
          range: s.label,
          /* Kuota habis menggantikan catatan biasa: itu yang paling perlu
             dibaca warga saat slotnya tidak bisa dipilih. */
          note: sisaKuota === 0 ? "Kuota penuh" : s.note,
          sisaKuota,
          full: sisaKuota === 0,
        };
      });

      return { data };
    },
    { query: Kueri },
  );
