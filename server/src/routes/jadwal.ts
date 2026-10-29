import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { bentrokDengan } from "../galat";
import { kategoriDariSlug } from "../jenis";
import {
  addresses,
  pickupItems,
  pickups,
  recurringScheduleItems,
  recurringSchedules,
  rwChannels,
  timeSlots,
  wasteCategories,
} from "../db/schema";

/**
 * Nama hari pada indeks `extract(dow)` Postgres: 0 = Minggu … 6 = Sabtu.
 * Frontend memakai nama hari, bukan angka, jadi penerjemahannya di sini —
 * satu tempat, bukan di setiap layar.
 */
const NAMA_HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

/* Minggu dibaca mulai Senin, seperti kalender yang dipakai warga. */
const URUTAN_HARI = [1, 2, 3, 4, 5, 6, 0];

/** Angka hari → nama, selalu urut Senin→Minggu apa pun urutan simpannya. */
const namaHari = (days: number[]) =>
  URUTAN_HARI.filter((d) => days.includes(d)).map((d) => NAMA_HARI[d]);

/* Nama hari → angka. Tidak peka huruf besar/kecil: "selasa" dan "Selasa"
   sama-sama dikirim orang. */
const INDEKS_HARI = new Map(
  NAMA_HARI.map((nama, i) => [nama.toLowerCase(), i]),
);

const BadanRutin = t.Object({
  addressId: t.String({ format: "uuid" }),
  timeSlotId: t.String({ format: "uuid" }),
  /* Nama hari, seperti yang dipilih warga di layar — bukan angka. */
  hari: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 7 }),
  jenis: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 4 }),
  mulai: t.Optional(t.String({ format: "date" })),
  sampai: t.Optional(t.Union([t.String({ format: "date" }), t.Null()])),
  pengingat: t.Optional(t.Boolean()),
});

/**
 * Status yang masih akan terjadi. "selesai" dan "batal" sudah lewat — tempatnya
 * di riwayat, bukan di jadwal.
 */
const BELUM_LEWAT = ["menunggu", "dijemput"] as const;

/**
 * Validasi isian jadwal rutin — dipakai bersama saat membuat dan mengubah.
 *
 * Mengembalikan `galat` berisi kode status + badan respons siap kirim, bukan
 * melempar. Satu tempat, jadi "ubah jadwal" tidak bisa pelan-pelan jadi lebih
 * longgar daripada "buat jadwal".
 */
async function siapkanRutin(
  db: Db,
  penggunaId: string,
  body: typeof BadanRutin.static,
) {
  const hariIni = new Date().toISOString().slice(0, 10);
  const mulai = body.mulai ?? hariIni;
  const sampai = body.sampai ?? null;

  if (sampai !== null && sampai < mulai) {
    return {
      galat: {
        kode: 422 as const,
        badan: { pesan: "Tanggal selesai jatuh sebelum tanggal mulai." },
      },
    };
  }

  /* Nama hari divalidasi di sini, bukan lewat enum di skema badan: pesannya
     harus menyebut hari mana yang tidak dikenal. */
  const hariUnik = [...new Set(body.hari.map((h) => h.toLowerCase()))];
  const tidakDikenal = hariUnik.filter((h) => !INDEKS_HARI.has(h));
  if (tidakDikenal.length > 0) {
    return {
      galat: {
        kode: 422 as const,
        badan: {
          pesan: "Ada nama hari yang tidak dikenal.",
          rincian: tidakDikenal,
        },
      },
    };
  }
  const days = hariUnik.map((h) => INDEKS_HARI.get(h)!).sort();

  /* Alamat harus milik si pengatur — sekaligus penentu petugas mana yang
     kelak menerima pesanannya. */
  const [alamat] = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(
      and(eq(addresses.id, body.addressId), eq(addresses.userId, penggunaId)),
    );
  if (!alamat) {
    return {
      galat: {
        kode: 404 as const,
        badan: { pesan: "Alamat jemput tidak ditemukan." },
      },
    };
  }

  const [slot] = await db
    .select({ id: timeSlots.id })
    .from(timeSlots)
    .where(and(eq(timeSlots.id, body.timeSlotId), eq(timeSlots.isActive, true)));
  if (!slot) {
    return {
      galat: {
        kode: 404 as const,
        badan: { pesan: "Jam jemput tidak tersedia." },
      },
    };
  }

  const jenis = await kategoriDariSlug(db, body.jenis);
  if ("galat" in jenis) {
    return { galat: { kode: 422 as const, badan: jenis.galat } };
  }

  return {
    days,
    alamatId: alamat.id,
    slotId: slot.id,
    mulai,
    sampai,
    pengingat: body.pengingat ?? true,
    jenis,
  };
}

/**
 * Jadwal milik warga ini, atau undefined.
 *
 * `userId` ikut di WHERE: jadwal warga lain dijawab 404, bukan 403 —
 * keberadaannya pun tidak perlu bocor.
 */
async function jadwalMilik(db: Db, penggunaId: string, id: string) {
  const [ada] = await db
    .select({ id: recurringSchedules.id })
    .from(recurringSchedules)
    .where(
      and(
        eq(recurringSchedules.id, id),
        eq(recurringSchedules.userId, penggunaId),
      ),
    );
  return ada;
}

/** Bentuk balasan setelah menyimpan — sama untuk buat dan ubah. */
const ringkas = (
  j: typeof recurringSchedules.$inferSelect,
  jenis: string[],
) => ({
  id: j.id,
  hari: namaHari(j.days),
  timeSlotId: j.timeSlotId,
  alamatId: j.addressId,
  mulai: j.startDate,
  sampai: j.endDate,
  dijeda: j.isPaused,
  jedaSampai: j.pausedUntil,
  pengingat: j.reminderEnabled,
  jenis,
});

/** Badan 409 saat dua jadwal memperebutkan alamat + jam yang sama. */
const BENTROK = {
  pesan:
    "Alamat ini sudah punya jadwal rutin di jam tersebut. Ubah jadwal yang ada, atau pilih jam lain.",
};

export const ruteJadwal = (db: Db) =>
  new Elysia({ prefix: "/jadwal" })
    .use(auth)

    /**
     * Jemput mendatang milik warga, yang paling dekat lebih dulu.
     *
     * Saringannya tanggal DAN status: pesanan "menunggu" bertanggal kemarin
     * sudah tidak mendatang lagi — itu pesanan tertinggal, dan tempatnya di
     * riwayat (`GET /api/pesanan`) supaya layar Jadwal tidak menjanjikan
     * petugas yang tidak akan datang.
     */
    .get("/mendatang", async ({ penggunaId }) => {
      const hariIni = new Date().toISOString().slice(0, 10);

      const baris = await db
        .select({
          id: pickups.id,
          code: pickups.code,
          status: pickups.status,
          tanggal: pickups.pickupDate,
          jam: timeSlots.label,
          jamMulai: timeSlots.startTime,
          alamatLabel: addresses.label,
          alamatLengkap: addresses.fullAddress,
          channelName: rwChannels.name,
          /* Penanda "Rutin" di kartu jadwal: pesanan ini lahir dari jadwal
             rutin, bukan dipesan satu-satu. */
          rutin: sql<boolean>`${pickups.recurringScheduleId} is not null`,
          /* Kategori digabung di SQL — menghindari satu query per pesanan. */
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
        .where(
          and(
            eq(pickups.userId, penggunaId),
            gte(pickups.pickupDate, hariIni),
            inArray(pickups.status, [...BELUM_LEWAT]),
          ),
        )
        .groupBy(pickups.id, addresses.id, timeSlots.id, rwChannels.id)
        /* Jam ikut diurut: dua jemput di hari yang sama harus berurutan
           seperti petugas benar-benar datang. */
        .orderBy(asc(pickups.pickupDate), asc(timeSlots.startTime));

      return { data: baris };
    })

    /**
     * Jadwal rutin milik warga, lengkap dengan hari, jam, alamat, dan jenis
     * sampahnya — isi kartu "Jadwal rutin" di layar Jadwal.
     *
     * Dikembalikan sebagai daftar, bukan satu objek: skema mengizinkan satu
     * jadwal per alamat per slot jam, jadi warga boleh punya jadwal pagi DAN
     * sore. Layar yang hanya menampilkan satu cukup mengambil yang pertama.
     */
    .get("/rutin", async ({ penggunaId }) => {
      const hariIni = new Date().toISOString().slice(0, 10);

      const baris = await db
        .select({
          id: recurringSchedules.id,
          days: recurringSchedules.days,
          timeSlotId: recurringSchedules.timeSlotId,
          jam: timeSlots.label,
          jamMulai: timeSlots.startTime,
          alamatId: recurringSchedules.addressId,
          alamatLabel: addresses.label,
          alamatLengkap: addresses.fullAddress,
          alamatPatokan: addresses.landmark,
          channelName: rwChannels.name,
          mulai: recurringSchedules.startDate,
          sampai: recurringSchedules.endDate,
          dijeda: recurringSchedules.isPaused,
          jedaSampai: recurringSchedules.pausedUntil,
          pengingat: recurringSchedules.reminderEnabled,
          jenis: sql<string[]>`coalesce(
            array_agg(${wasteCategories.slug}) filter (
              where ${wasteCategories.slug} is not null
            ), '{}'
          )`,
        })
        .from(recurringSchedules)
        .innerJoin(addresses, eq(recurringSchedules.addressId, addresses.id))
        .innerJoin(timeSlots, eq(recurringSchedules.timeSlotId, timeSlots.id))
        .leftJoin(rwChannels, eq(addresses.rwChannelId, rwChannels.id))
        .leftJoin(
          recurringScheduleItems,
          eq(recurringScheduleItems.scheduleId, recurringSchedules.id),
        )
        .leftJoin(
          wasteCategories,
          eq(recurringScheduleItems.categoryId, wasteCategories.id),
        )
        .where(eq(recurringSchedules.userId, penggunaId))
        .groupBy(
          recurringSchedules.id,
          addresses.id,
          timeSlots.id,
          rwChannels.id,
        )
        .orderBy(asc(timeSlots.startTime));

      return {
        data: baris.map(({ days, ...j }) => ({
          ...j,
          hari: namaHari(days),
          /* "Berjalan" bukan sekadar lawan dari "dijeda": jadwal yang belum
             mulai atau sudah berakhir juga tidak mengirim petugas. */
          berjalan:
            !j.dijeda &&
            j.mulai <= hariIni &&
            (j.sampai === null || j.sampai >= hariIni),
        })),
      };
    })

    /**
     * Atur jadwal rutin baru.
     *
     * Tidak ada gerbang langganan di sini: mengatur jadwal adalah pengaturan,
     * bukan permintaan jemput. Gerbangnya ada di pesanan yang lahir dari
     * jadwal ini — warga boleh menyiapkan jadwalnya sebelum berlangganan.
     */
    .post(
      "/rutin",
      async ({ penggunaId, body }) => {
        const siap = await siapkanRutin(db, penggunaId, body);
        if (siap.galat) return status(siap.galat.kode, siap.galat.badan);

        try {
          const jadwal = await db.transaction(async (tx) => {
            const [baru] = await tx
              .insert(recurringSchedules)
              .values({
                userId: penggunaId,
                addressId: siap.alamatId,
                timeSlotId: siap.slotId,
                days: siap.days,
                startDate: siap.mulai,
                endDate: siap.sampai,
                reminderEnabled: siap.pengingat,
              })
              .returning();

            await tx.insert(recurringScheduleItems).values(
              siap.jenis.kategori.map((k) => ({
                scheduleId: baru.id,
                categoryId: k.id,
              })),
            );

            return baru;
          });

          return status(201, { data: ringkas(jadwal, siap.jenis.unik) });
        } catch (e) {
          /* Satu jadwal per alamat per jam — dua jadwal kembar akan saling
             menimpa dan mengirim petugas dua kali. */
          if (bentrokDengan(e, "recurring_schedules_alamat_slot_idx")) {
            return status(409, BENTROK);
          }
          throw e;
        }
      },
      { body: BadanRutin },
    )

    /**
     * Ubah jadwal rutin: ganti seluruh isinya sekaligus.
     *
     * Bukan tambal sebagian, karena layar "Ubah jadwal" mengirim formulir
     * utuh — hari, jam, alamat, dan jenis sampah dipilih bersama-sama di satu
     * layar. Status jeda sengaja TIDAK disentuh di sini; itu urusan endpoint
     * jeda, supaya menyimpan perubahan jadwal tidak diam-diam menjalankan
     * kembali jadwal yang sedang dijeda.
     */
    .put(
      "/rutin/:id",
      async ({ penggunaId, params, body }) => {
        const ada = await jadwalMilik(db, penggunaId, params.id);
        if (!ada) return status(404, { pesan: "Jadwal rutin tidak ditemukan." });

        const siap = await siapkanRutin(db, penggunaId, body);
        if (siap.galat) return status(siap.galat.kode, siap.galat.badan);

        try {
          const jadwal = await db.transaction(async (tx) => {
            const [ubah] = await tx
              .update(recurringSchedules)
              .set({
                addressId: siap.alamatId,
                timeSlotId: siap.slotId,
                days: siap.days,
                startDate: siap.mulai,
                endDate: siap.sampai,
                reminderEnabled: siap.pengingat,
                updatedAt: new Date(),
              })
              .where(eq(recurringSchedules.id, params.id))
              .returning();

            /* Jenis diganti utuh: yang tidak lagi dipilih harus hilang, bukan
               menumpuk dari versi sebelumnya. */
            await tx
              .delete(recurringScheduleItems)
              .where(eq(recurringScheduleItems.scheduleId, params.id));
            await tx.insert(recurringScheduleItems).values(
              siap.jenis.kategori.map((k) => ({
                scheduleId: params.id,
                categoryId: k.id,
              })),
            );

            return ubah;
          });

          return { data: ringkas(jadwal, siap.jenis.unik) };
        } catch (e) {
          if (bentrokDengan(e, "recurring_schedules_alamat_slot_idx")) {
            return status(409, BENTROK);
          }
          throw e;
        }
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        body: BadanRutin,
      },
    )

    /**
     * Jeda jadwal rutin, mis. saat warga keluar kota.
     *
     * Menjeda bukan cuma menyetel penanda: jemput yang sudah terjadwal di
     * rentang jeda ikut dibatalkan, karena itulah yang dijanjikan layar
     * "Jeda jadwal" sebelum warga menekan tombolnya. Yang statusnya sudah
     * "dijemput" dibiarkan — petugas sudah di jalan, dan membatalkannya di
     * aplikasi tidak mengubah kenyataan di lapangan.
     *
     * Menjeda jadwal yang sudah dijeda tidak ditolak: itu cara warga menggeser
     * tanggal selesai jeda.
     */
    .put(
      "/rutin/:id/jeda",
      async ({ penggunaId, params, body }) => {
        const ada = await jadwalMilik(db, penggunaId, params.id);
        if (!ada) return status(404, { pesan: "Jadwal rutin tidak ditemukan." });

        const hariIni = new Date().toISOString().slice(0, 10);
        const sampai = body.sampai ?? null;
        if (sampai !== null && sampai < hariIni) {
          return status(422, {
            pesan: "Tanggal selesai jeda sudah lewat. Pilih tanggal ke depan.",
          });
        }

        const hasil = await db.transaction(async (tx) => {
          const [jadwal] = await tx
            .update(recurringSchedules)
            .set({ isPaused: true, pausedUntil: sampai, updatedAt: new Date() })
            .where(eq(recurringSchedules.id, params.id))
            .returning();

          const dibatalkan = await tx
            .update(pickups)
            .set({ status: "batal", updatedAt: new Date() })
            .where(
              and(
                eq(pickups.recurringScheduleId, params.id),
                eq(pickups.status, "menunggu"),
                gte(pickups.pickupDate, hariIni),
                sampai === null
                  ? undefined
                  : lte(pickups.pickupDate, sampai),
              ),
            )
            .returning({ id: pickups.id });

          return { jadwal, jumlah: dibatalkan.length };
        });

        return {
          data: {
            id: hasil.jadwal.id,
            dijeda: hasil.jadwal.isPaused,
            jedaSampai: hasil.jadwal.pausedUntil,
            /* Jumlahnya dikembalikan supaya layar bisa menyebut angka yang
               benar-benar terjadi, bukan perkiraan sebelum menekan. */
            dibatalkan: hasil.jumlah,
          },
        };
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        body: t.Object({
          /* null = dijeda sampai warga menyalakannya sendiri. */
          sampai: t.Optional(
            t.Union([t.String({ format: "date" }), t.Null()]),
          ),
        }),
      },
    )

    /**
     * Jalankan lagi jadwal yang dijeda.
     *
     * Pesanan yang sudah dibatalkan saat menjeda tidak dibangkitkan kembali —
     * jemput berikutnya lahir dari jadwal ini seperti biasa.
     */
    .put(
      "/rutin/:id/jalan",
      async ({ penggunaId, params }) => {
        const ada = await jadwalMilik(db, penggunaId, params.id);
        if (!ada) return status(404, { pesan: "Jadwal rutin tidak ditemukan." });

        const [jadwal] = await db
          .update(recurringSchedules)
          .set({ isPaused: false, pausedUntil: null, updatedAt: new Date() })
          .where(eq(recurringSchedules.id, params.id))
          .returning();

        return {
          data: {
            id: jadwal.id,
            dijeda: jadwal.isPaused,
            jedaSampai: jadwal.pausedUntil,
          },
        };
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    )

    /**
     * Nyalakan/matikan pengingat jemput.
     *
     * Terpisah dari "ubah jadwal" karena warga menekannya langsung dari kartu
     * jadwal — mengubah pengingat tidak mengubah jadwalnya, jadi tidak pantas
     * menyeret warga melewati seluruh formulir hanya untuk ini.
     *
     * Hanya menyimpan nyala/mati. Pilihan WAKTU pengingat ("sehari sebelum" /
     * "pagi harinya") masih keadaan layar saja — belum ada kolomnya, dan
     * menambahkannya menunggu task pengingat yang benar-benar mengirim pesan.
     */
    .put(
      "/rutin/:id/pengingat",
      async ({ penggunaId, params, body }) => {
        const ada = await jadwalMilik(db, penggunaId, params.id);
        if (!ada) return status(404, { pesan: "Jadwal rutin tidak ditemukan." });

        const [jadwal] = await db
          .update(recurringSchedules)
          .set({ reminderEnabled: body.aktif, updatedAt: new Date() })
          .where(eq(recurringSchedules.id, params.id))
          .returning();

        return { data: { id: jadwal.id, pengingat: jadwal.reminderEnabled } };
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        body: t.Object({ aktif: t.Boolean() }),
      },
    );
