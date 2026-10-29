import { desc, sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
  Skema inti alur "Pesan Jemput Sampah" (Fase 1).

  Tabel fase berikutnya (payments, channel_posts, feedbacks,
  waste_guide_items) menyusul di task-nya sendiri — kolom FK ke tabel yang
  belum ada sengaja belum ditulis supaya migrasi tetap bisa dijalankan.
*/

export const peranPengguna = pgEnum("peran_pengguna", ["warga", "pengurus"]);

export const siklusTagihan = pgEnum("siklus_tagihan", [
  "mingguan",
  "bulanan",
]);

export const statusLangganan = pgEnum("status_langganan", [
  "aktif",
  "kedaluwarsa",
  "menunggu_bayar",
]);

/** `menunggu` = sudah mengajukan gabung, belum disetujui pengurus. */
export const statusKeanggotaan = pgEnum("status_keanggotaan", [
  "aktif",
  "menunggu",
]);

export const statusPickup = pgEnum("status_pickup", [
  "menunggu",
  "dijemput",
  "selesai",
  "batal",
]);

/**
 * Profil aplikasi. `id` sengaja sama dengan `auth.users.id` milik Supabase Auth
 * supaya RLS bisa memakai `auth.uid()` langsung tanpa tabel pemetaan.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    role: peranPengguna("role").notNull().default("warga"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_phone_idx").on(t.phone),
    uniqueIndex("users_email_idx").on(t.email),
    // Minimal satu kontak harus ada — nomor HP ATAU email, tidak boleh kosong
    // dua-duanya, karena pengingat jadwal dikirim lewat salah satunya.
    check(
      "users_punya_kontak",
      sql`${t.phone} is not null or ${t.email} is not null`,
    ),
  ],
);

/** Channel RT/RW — menentukan petugas mana yang menerima pesanan. */
export const rwChannels = pgTable(
  "rw_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    rtNumber: text("rt_number"),
    rwNumber: text("rw_number"),
    kelurahan: text("kelurahan"),
    areaCode: text("area_code").notNull(),
    /* Titik balai RW, bukan batas wilayahnya — dipakai mengurutkan "channel
       terdekat" dari alamat warga. Nullable: channel yang dibuat pengurus
       sebelum titiknya ditandai tetap harus bisa dipakai, ia hanya jatuh ke
       urutan paling bawah. Numeric, bukan PostGIS: yang ditanyakan selalu
       "RW mana yang paling dekat", dan jarak lurus sudah menjawabnya. */
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rw_channels_area_code_idx").on(t.areaCode),
    check(
      "rw_channels_titik_wajar",
      /* `is not null` ditulis eksplisit: tanpa itu, lintang terisi + bujur
         kosong membuat perbandingannya bernilai UNKNOWN, dan CHECK meloloskan
         UNKNOWN. Titik setengah seperti itu tidak bisa dipakai menghitung
         jarak, jadi channel-nya akan hilang dari daftar "terdekat" tanpa
         sebab yang kelihatan. */
      sql`(${t.latitude} is null and ${t.longitude} is null)
          or (${t.latitude} is not null and ${t.longitude} is not null
              and ${t.latitude} between -90 and 90
              and ${t.longitude} between -180 and 180)`,
    ),
  ],
);

/**
 * Keanggotaan warga di sebuah channel RT/RW.
 *
 * Yang bisa dihitung tidak disimpan: jumlah anggota, nama pengurus, dan
 * "apakah aku anggota" semuanya dibaca dari tabel ini saat diminta. Menyimpan
 * `member_count` di `rw_channels` berarti satu angka yang bisa melenceng dari
 * daftar anggotanya sendiri — dan angka itulah yang dipakai warga menilai
 * apakah channel-nya ramai.
 *
 * `is_pengurus` ada di sini, bukan di `users.role`: seseorang bisa pengurus di
 * RW-nya sendiri dan warga biasa di channel RW sebelah tempat warungnya.
 *
 * Patokan rumah yang tampil di daftar anggota tidak ikut disimpan — ia dibaca
 * dari alamat warga di channel ini, supaya tidak ada dua versi yang berbeda
 * saat warga memperbarui alamatnya.
 */
export const channelMembers = pgTable(
  "channel_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => rwChannels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: statusKeanggotaan("status").notNull().default("menunggu"),
    isPengurus: boolean("is_pengurus").notNull().default(false),
    /* "Ketua RW 05", "Sekretaris RW 05". Ditulis di sini, bukan disalin ke
       tiap pengumuman: kalau jabatannya salah ketik, yang harus dibetulkan
       satu baris — bukan tiap pengumuman yang pernah ia tulis. */
    jabatan: text("jabatan"),
    /* Satu waktu untuk dua arti: kalau `menunggu`, ini kapan mengajukan;
       kalau `aktif`, kapan diterima. Daftar anggota hanya menampilkan
       umurnya, jadi dua kolom terpisah tidak pernah terbaca berbeda. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Satu warga satu keanggotaan per channel — mengajukan dua kali tidak
    // boleh membuat dua baris menunggu yang harus disetujui dua kali.
    uniqueIndex("channel_members_unik_idx").on(t.channelId, t.userId),
    // Daftar anggota & antrean persetujuan pengurus: per channel, per status.
    index("channel_members_channel_status_idx").on(t.channelId, t.status),
    // "Channel apa saja yang aku ikuti" di layar daftar channel.
    index("channel_members_user_idx").on(t.userId),
    /*
      RLS: warga membaca barisnya sendiri, dan daftar anggota channel yang
      benar-benar ia ikuti.

      `ikut_channel()` dipakai, bukan sub-query ke tabel ini: kebijakan di
      channel_members yang menanyai channel_members akan berputar dan Postgres
      menolaknya dengan galat rekursi. Fungsinya SECURITY DEFINER, jadi ia
      melihat tabel tanpa lewat kebijakan ini lagi.

      Hanya SELECT. Gabung dan persetujuan tetap lewat API — di sanalah
      aturan "yang menyetujui harus pengurus" ditegakkan.
    */
    pgPolicy("channel_members_baca_sesama_anggota", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}
        or ikut_channel(${t.channelId})`,
    }),
  ],
);

/**
 * Jadwal angkut sebuah channel: hari-hari apa truknya lewat, di jam mana.
 *
 * Menggantikan `rw_channels.schedule_info` yang berupa satu kalimat bebas.
 * Kalimat itu tidak bisa ditanyai "apakah besok hari angkut RW ini", jadi
 * pengingat dan antrean petugas tidak punya apa pun untuk dipegang — dan
 * begitu kalimatnya diperbarui tanpa jadwal sungguhan ikut berubah, warga
 * membaca hari yang sudah tidak benar.
 *
 * Bentuknya meniru `recurring_schedules` milik warga: satu baris per slot jam
 * dengan daftar harinya, bukan satu baris per hari. Satu channel biasanya
 * hanya punya satu atau dua slot.
 *
 * Kalimat "Selasa & Jumat, 06.00–08.00" dirakit di layar, dengan perakit yang
 * sudah dipakai jadwal rutin warga — supaya kata-katanya persis sama.
 */
export const channelSchedules = pgTable(
  "channel_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => rwChannels.id, { onDelete: "cascade" }),
    timeSlotId: uuid("time_slot_id")
      .notNull()
      .references(() => timeSlots.id, { onDelete: "restrict" }),
    /* 0 = Minggu, seperti `recurring_schedules.days` dan Date.getDay(). */
    days: smallint("days").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Satu baris per slot jam: boleh angkut pagi DAN sore, tapi tidak boleh
    // dua baris pagi yang saling menimpa.
    uniqueIndex("channel_schedules_unik_idx").on(t.channelId, t.timeSlotId),
    check(
      "channel_schedules_hari_sah",
      sql`${t.days} <@ array[0,1,2,3,4,5,6]::smallint[]
          and cardinality(${t.days}) between 1 and 7`,
    ),
    /* Jadwal angkut RW bukan rahasia — warga perlu membacanya SEBELUM
       memutuskan gabung. Karena itu seluruh pengguna yang sudah masuk boleh
       membacanya, tidak hanya anggotanya. */
    pgPolicy("channel_schedules_baca_semua", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);

/**
 * Pengumuman pengurus di sebuah channel.
 *
 * `author_id` set null, bukan cascade: pengumuman jam angkut dan iuran masih
 * dirujuk warga lama setelah ditulis, dan pengurus yang pindah rumah tidak
 * boleh ikut menghapus arsip RT.
 *
 * Nama dan jabatan penulis tidak disalin ke sini — dibaca dari keanggotaannya,
 * supaya tidak ada dua versi jabatan yang berbeda di dua pengumuman.
 */
export const channelPosts = pgTable(
  "channel_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => rwChannels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Daftar pengumuman satu channel, terbaru di atas.
    index("channel_posts_channel_dibuat_idx").on(t.channelId, t.createdAt.desc()),
    check("channel_posts_judul_terisi", sql`length(btrim(${t.title})) > 0`),
    check("channel_posts_isi_terisi", sql`length(btrim(${t.content})) > 0`),
    /* Hanya anggota aktif. Pengumuman menyebut alamat dan kebiasaan rumah
       warga ("karung di pos ronda"), jadi ia bukan papan pengumuman umum. */
    pgPolicy("channel_posts_baca_anggota", {
      for: "select",
      to: authenticatedRole,
      using: sql`ikut_channel(${t.channelId})`,
    }),
  ],
);

/** Alamat jemput tersimpan milik warga. */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    fullAddress: text("full_address").notNull(),
    landmark: text("landmark"),
    rwChannelId: uuid("rw_channel_id").references(() => rwChannels.id, {
      onDelete: "set null",
    }),
    /* Titik rumah. Pasangan dari titik balai RW di `rw_channels`: tanpa kedua
       ujungnya, "channel terdekat" tidak bisa dihitung sama sekali. Nullable —
       warga yang belum menandai rumahnya tetap bisa memesan jemput, daftar
       channel-nya saja yang tidak terurut jarak. */
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("addresses_user_id_idx").on(t.userId),
    // Satu alamat utama per warga. Partial unique index menegakkannya di DB,
    // jadi dua request bersamaan tidak bisa membuat dua alamat utama.
    uniqueIndex("addresses_satu_utama_idx")
      .on(t.userId)
      .where(sql`${t.isDefault}`),
    /* Sama seperti rw_channels: titik setengah ditolak, bukan diloloskan
       sebagai UNKNOWN. */
    check(
      "addresses_titik_wajar",
      sql`(${t.latitude} is null and ${t.longitude} is null)
          or (${t.latitude} is not null and ${t.longitude} is not null
              and ${t.latitude} between -90 and 90
              and ${t.longitude} between -180 and 180)`,
    ),
  ],
);

/** Kategori panduan pilah: organik, plastik, kertas, campuran. */
export const wasteCategories = pgTable(
  "waste_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    handlingTip: text("handling_tip"),
  },
  (t) => [uniqueIndex("waste_categories_slug_idx").on(t.slug)],
);

/**
 * Slot jam penjemputan yang ditawarkan ke warga.
 *
 * `capacity` adalah jumlah pesanan yang sanggup diangkut petugas dalam satu
 * slot pada satu hari. Sisa kuota dihitung saat diminta (pesanan hari itu
 * dibanding kapasitas) — tidak disimpan, supaya tidak pernah melenceng dari
 * data pesanan yang sebenarnya.
 */
export const timeSlots = pgTable(
  "time_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* Label yang dibaca warga, mis. "06.00–08.00". */
    label: text("label").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    note: text("note"),
    capacity: smallint("capacity").notNull().default(20),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /* NULL = berlaku untuk semua channel. Diisi kalau satu RW punya jam
       angkut sendiri. */
    channelId: uuid("channel_id").references(() => rwChannels.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [
    index("time_slots_channel_urut_idx").on(t.channelId, t.sortOrder),
    check("time_slots_kapasitas_positif", sql`${t.capacity} > 0`),
    check("time_slots_jam_urut", sql`${t.endTime} > ${t.startTime}`),
  ],
);

/** Pesanan penjemputan. */
export const pickups = pgTable(
  "pickups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* Kode pendek yang dibaca warga dan petugas, mis. PY-4833. */
    code: text("code").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /* Alamat boleh dihapus warga; pesanan lama tetap tersimpan sebagai
       riwayat, karena itu restrict bukan cascade. */
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id, { onDelete: "restrict" }),
    channelId: uuid("channel_id").references(() => rwChannels.id, {
      onDelete: "set null",
    }),
    /* `mode: "string"` menjaga bentuk ISO yyyy-mm-dd seperti yang dikirim
       frontend, tapi tipenya tetap DATE asli supaya antrean petugas bisa
       query rentang tanggal dan urutannya benar lintas bulan. */
    pickupDate: date("pickup_date", { mode: "string" }).notNull(),
    timeSlotId: uuid("time_slot_id")
      .notNull()
      .references(() => timeSlots.id, { onDelete: "restrict" }),
    status: statusPickup("status").notNull().default("menunggu"),
    totalWeightKg: numeric("total_weight_kg", { precision: 6, scale: 2 }),
    officerName: text("officer_name"),
    proofUrl: text("proof_url"),
    notes: text("notes"),
    /* Terisi kalau pesanan ini lahir dari jadwal rutin. Jadwal boleh dihapus
       warga; pesanan yang sudah terjadi tetap jadi riwayat, karena itu
       set null. */
    recurringScheduleId: uuid("recurring_schedule_id").references(
      (): AnyPgColumn => recurringSchedules.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("pickups_code_idx").on(t.code),
    // Riwayat warga: daftar pesanan terbaru lebih dulu.
    index("pickups_user_dibuat_idx").on(t.userId, t.createdAt.desc()),
    // Antrean petugas: pesanan satu channel pada tanggal tertentu.
    index("pickups_channel_tanggal_idx").on(t.channelId, t.pickupDate),
    // Hitung sisa kuota per slot per hari tanpa memindai seluruh tabel.
    index("pickups_kuota_idx").on(t.pickupDate, t.timeSlotId, t.channelId),
    check(
      "pickups_berat_tidak_negatif",
      sql`${t.totalWeightKg} is null or ${t.totalWeightKg} >= 0`,
    ),
    /*
      RLS: warga hanya boleh MEMBACA penjemputannya sendiri.

      Lapis ini bukan pengganti pemeriksaan di route — API memakai koneksi
      service role dan melewati RLS. Gunanya untuk jalur yang TIDAK lewat
      route: Supabase Realtime (status pesanan berubah sendiri di layar warga)
      dan PostgREST berlangganan dengan peran `authenticated`, dan di sanalah
      satu-satunya yang menahan warga membaca alamat tetangganya adalah
      kebijakan ini.

      Hanya SELECT. Menulis tetap harus lewat API, karena di sanalah gerbang
      langganan, kuota slot, dan aturan pembatalan ditegakkan — kebijakan
      INSERT/UPDATE untuk warga akan memberi jalan memutarinya.
    */
    pgPolicy("pickups_baca_milik_sendiri", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
  ],
);

/** Rincian jenis sampah per pesanan. */
export const pickupItems = pgTable(
  "pickup_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pickupId: uuid("pickup_id")
      .notNull()
      .references(() => pickups.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => wasteCategories.id, { onDelete: "restrict" }),
    estimatedWeightKg: numeric("estimated_weight_kg", {
      precision: 6,
      scale: 2,
    }),
  },
  (t) => [
    // Satu kategori hanya boleh muncul sekali dalam satu pesanan.
    uniqueIndex("pickup_items_unik_idx").on(t.pickupId, t.categoryId),
    /* Rincian jenis ikut induknya: terbaca kalau penjemputannya terbaca. */
    pgPolicy("pickup_items_ikut_induk", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (
        select 1 from ${pickups} p
        where p.id = ${t.pickupId} and p.user_id = ${authUid}
      )`,
    }),
  ],
);

/** Paket langganan yang ditawarkan. */
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    billingCycle: siklusTagihan("billing_cycle").notNull(),
    /* Rupiah penuh — tidak ada sen, jadi integer aman dan bebas galat
       pembulatan desimal. */
    price: integer("price").notNull(),
    pickupQuota: smallint("pickup_quota").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    check("subscription_plans_harga_wajar", sql`${t.price} >= 0`),
    check("subscription_plans_kuota_positif", sql`${t.pickupQuota} > 0`),
  ],
);

/** Langganan milik warga. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    status: statusLangganan("status").notNull().default("menunggu_bayar"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    autoRenew: boolean("auto_renew").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("subscriptions_user_idx").on(t.userId, desc(t.endDate)),
    // Satu langganan aktif per warga pada satu waktu.
    uniqueIndex("subscriptions_satu_aktif_idx")
      .on(t.userId)
      .where(sql`${t.status} = 'aktif'`),
    check("subscriptions_periode_urut", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

/**
 * Jadwal rutin jemput — nilai jual utama aplikasi: warga mengatur sekali,
 * petugas datang terus.
 *
 * `days` memakai angka hari ala Postgres/JS (0 = Minggu … 6 = Sabtu), bukan
 * nama hari, supaya penghasil pesanan bisa mencocokkan langsung dengan
 * `extract(dow from tanggal) = any(days)` tanpa tabel pemetaan.
 */
export const recurringSchedules = pgTable(
  "recurring_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /* Jadwal ikut hilang kalau alamatnya dihapus — tanpa alamat tidak ada
       yang bisa dijemput. */
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id, { onDelete: "cascade" }),
    timeSlotId: uuid("time_slot_id")
      .notNull()
      .references(() => timeSlots.id, { onDelete: "restrict" }),
    days: smallint("days").array().notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    /* NULL = berjalan sampai warga menghentikannya sendiri. */
    endDate: date("end_date", { mode: "string" }),
    isPaused: boolean("is_paused").notNull().default(false),
    /* Tanggal jeda berakhir. NULL saat dijeda = sampai dinyalakan manual. */
    pausedUntil: date("paused_until", { mode: "string" }),
    reminderEnabled: boolean("reminder_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("recurring_schedules_user_idx").on(t.userId),
    // Satu jadwal per alamat per slot jam: boleh punya jadwal pagi DAN sore,
    // tapi tidak boleh dua jadwal kembar yang saling menimpa.
    uniqueIndex("recurring_schedules_alamat_slot_idx").on(
      t.addressId,
      t.timeSlotId,
    ),
    // Penghasil pesanan hanya melihat jadwal yang sedang berjalan.
    index("recurring_schedules_aktif_idx")
      .on(t.startDate)
      .where(sql`not ${t.isPaused}`),
    check(
      "recurring_schedules_hari_sah",
      sql`${t.days} <@ array[0,1,2,3,4,5,6]::smallint[]
          and cardinality(${t.days}) between 1 and 7`,
    ),
    check(
      "recurring_schedules_periode_urut",
      sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`,
    ),
    // Tanggal akhir jeda tanpa status dijeda tidak punya arti — dan akan
    // membuat layar "Ubah atau Jeda Jadwal" menampilkan dua hal berbeda.
    check(
      "recurring_schedules_jeda_konsisten",
      sql`${t.pausedUntil} is null or ${t.isPaused}`,
    ),
  ],
);

/** Jenis sampah yang diambil tiap kali jadwal rutin ini jalan. */
export const recurringScheduleItems = pgTable(
  "recurring_schedule_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => recurringSchedules.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => wasteCategories.id, { onDelete: "restrict" }),
  },
  (t) => [
    // Satu kategori sekali saja per jadwal — seperti pickup_items.
    uniqueIndex("recurring_schedule_items_unik_idx").on(
      t.scheduleId,
      t.categoryId,
    ),
  ],
);

export type Pickup = typeof pickups.$inferSelect;
export type PickupBaru = typeof pickups.$inferInsert;
export type PickupItem = typeof pickupItems.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type WasteCategory = typeof wasteCategories.$inferSelect;
export type RwChannel = typeof rwChannels.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type ChannelSchedule = typeof channelSchedules.$inferSelect;
export type ChannelPost = typeof channelPosts.$inferSelect;
export type ChannelPostBaru = typeof channelPosts.$inferInsert;
export type ChannelMemberBaru = typeof channelMembers.$inferInsert;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type User = typeof users.$inferSelect;
export type RecurringSchedule = typeof recurringSchedules.$inferSelect;
export type RecurringScheduleBaru = typeof recurringSchedules.$inferInsert;
export type RecurringScheduleItem =
  typeof recurringScheduleItems.$inferSelect;
