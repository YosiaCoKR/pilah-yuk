import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { bentrokDengan } from "../galat";
import {
  addresses,
  channelMembers,
  channelSchedules,
  channelPosts,
  rwChannels,
  timeSlots,
  users,
} from "../db/schema";

/**
 * Jarak kasar dalam meter antara titik channel dan titik alamat warga.
 *
 * Bumi diratakan: satu derajat lintang dihitung 111.320 m dan bujurnya
 * dikalikan cos(lintang). Yang ditanyakan layar ini selalu "RW mana yang
 * paling dekat" dalam radius beberapa kilometer, dan pada jarak itu
 * pendekatan ini dan haversine memberi urutan yang sama.
 *
 * ponytail: pendekatan bidang rata, keliru makin jauh dari titik acuan.
 * Kalau kelak channel dicari lintas kota, ganti dengan haversine (atau
 * PostGIS) — bukan sebelum itu.
 */
const jarakMeter = (lat: string | null, lng: string | null) => {
  /* Di-cast eksplisit: saat warga belum menandai rumahnya, parameternya NULL
     dan Postgres menolak query-nya dengan "indeterminate datatype" — bukan
     mengembalikan null seperti yang diharapkan. */
  const aLat = sql`cast(${lat} as double precision)`;
  const aLng = sql`cast(${lng} as double precision)`;
  return sql<number | null>`
    case
      when ${rwChannels.latitude} is null or ${aLat} is null then null
      else round(111320 * sqrt(
        power(${rwChannels.latitude}::double precision - ${aLat}, 2)
        + power(
            (${rwChannels.longitude}::double precision - ${aLng})
            * cos(radians(${aLat})), 2)
      ))::int
    end`;
};

/** Jumlah anggota aktif — dihitung, tidak disimpan. */
const jumlahAnggota = sql<number>`(
  select count(*)::int from ${channelMembers} a
  where a.channel_id = ${rwChannels.id} and a.status = 'aktif'
)`;

/** Nama satu pengurus channel, untuk baris "Pak Hendra · 142 warga". */
const namaPengurus = sql<string | null>`(
  select u.full_name from ${channelMembers} a
  join users u on u.id = a.user_id
  where a.channel_id = ${rwChannels.id}
    and a.status = 'aktif' and a.is_pengurus
  order by a.created_at
  limit 1
)`;

/**
 * Pengumuman satu channel, terbaru dulu.
 *
 * Nama dan jabatan penulis dibaca dari keanggotaannya di channel INI — bukan
 * dari jabatan di channel lain yang mungkin ia ikuti juga.
 */
const pilihPengumuman = (db: Db, channelId: string) =>
  db
    .select({
      id: channelPosts.id,
      title: channelPosts.title,
      content: channelPosts.content,
      dibuatPada: channelPosts.createdAt,
      author: users.fullName,
      authorRole: channelMembers.jabatan,
    })
    .from(channelPosts)
    .leftJoin(users, eq(users.id, channelPosts.authorId))
    .leftJoin(
      channelMembers,
      and(
        eq(channelMembers.channelId, channelPosts.channelId),
        eq(channelMembers.userId, channelPosts.authorId),
      ),
    )
    .where(eq(channelPosts.channelId, channelId))
    .orderBy(desc(channelPosts.createdAt));

/** Jadwal angkut satu channel, urut jam. */
const pilihJadwal = (db: Db, channelId: string) =>
  db
    .select({ days: channelSchedules.days, jam: timeSlots.label })
    .from(channelSchedules)
    .innerJoin(timeSlots, eq(timeSlots.id, channelSchedules.timeSlotId))
    .where(eq(channelSchedules.channelId, channelId))
    .orderBy(timeSlots.sortOrder, timeSlots.startTime);

export const ruteChannel = (db: Db) =>
  new Elysia({ prefix: "/channel" })
    .use(auth)

    /**
     * Daftar channel: yang diikuti warga, dan yang bisa diikuti.
     *
     * Satu daftar, bukan dua endpoint. Layar menampilkan "Channel kamu" dan
     * "Channel terdekat" bersamaan, dan memisahkannya di server berarti dua
     * permintaan yang bisa saling mendahului — sesaat sebuah channel bisa
     * muncul di dua seksi atau hilang dari keduanya.
     *
     * `jarakM` dihitung dari alamat utama warga. Null kalau titik salah satu
     * ujungnya belum ditandai; layar menurunkannya ke urutan paling bawah,
     * bukan menganggapnya jarak nol.
     */
    .get(
      "/",
      async ({ penggunaId, query }) => {
        /* Alamat utama jadi titik acuan. Kalau belum ada yang ditandai utama,
           alamat mana pun yang bertitik lebih berguna daripada tidak ada
           acuan sama sekali. */
        const [acuan] = await db
          .select({ lat: addresses.latitude, lng: addresses.longitude })
          .from(addresses)
          .where(
            and(eq(addresses.userId, penggunaId), isNotNull(addresses.latitude)),
          )
          .orderBy(sql`${addresses.isDefault} desc`, addresses.createdAt)
          .limit(1);

        const lat = acuan?.lat ?? null;
        const lng = acuan?.lng ?? null;

        const cari = query.q?.trim();
        const baris = await db
          .select({
            id: rwChannels.id,
            name: rwChannels.name,
            rtNumber: rwChannels.rtNumber,
            rwNumber: rwChannels.rwNumber,
            kelurahan: rwChannels.kelurahan,
            areaCode: rwChannels.areaCode,
            jarakM: jarakMeter(lat, lng),
            memberCount: jumlahAnggota,
            pengurus: namaPengurus,
            /* Status keanggotaan warga ini di channel ini: null kalau belum
               pernah mengajukan, "menunggu" kalau sudah tapi belum disetujui.
               Layar membedakan ketiganya — tombol "Gabung", "Menunggu
               persetujuan", dan lencana "Channelmu". */
            statusKeanggotaan: channelMembers.status,
            isPengurus: channelMembers.isPengurus,
          })
          .from(rwChannels)
          .leftJoin(
            channelMembers,
            and(
              eq(channelMembers.channelId, rwChannels.id),
              eq(channelMembers.userId, penggunaId),
            ),
          )
          .where(
            cari
              ? sql`(${rwChannels.name} ilike ${"%" + cari + "%"}
                  or ${rwChannels.kelurahan} ilike ${"%" + cari + "%"}
                  or ${rwChannels.areaCode} = ${cari})`
              : undefined,
          )
          /* Yang diikuti dulu, lalu yang terdekat. `nulls last` penting:
             tanpa itu channel tanpa titik justru naik ke atas. */
          .orderBy(
            sql`${channelMembers.status} is null`,
            sql`${jarakMeter(lat, lng)} asc nulls last`,
            rwChannels.name,
          );

        /* Satu query untuk seluruh channel di daftar, bukan satu per baris:
           daftarnya pendek, tapi N+1 di layar pertama adalah N+1 yang paling
           sering dibuka. */
        const jadwal = await db
          .select({
            channelId: channelSchedules.channelId,
            days: channelSchedules.days,
            jam: timeSlots.label,
          })
          .from(channelSchedules)
          .innerJoin(timeSlots, eq(timeSlots.id, channelSchedules.timeSlotId))
          .orderBy(timeSlots.sortOrder, timeSlots.startTime);

        const jadwalPerChannel = new Map<string, { days: number[]; jam: string }[]>();
        for (const j of jadwal) {
          const daftar = jadwalPerChannel.get(j.channelId) ?? [];
          daftar.push({ days: j.days, jam: j.jam });
          jadwalPerChannel.set(j.channelId, daftar);
        }

        return {
          data: baris.map((c) => ({
            ...c,
            /* Terstruktur, bukan satu kalimat jadi: layar merakitnya dengan
               perakit yang sama seperti jadwal rutin warga, jadi "Selasa &
               Jumat" terbaca persis sama di dua tempat. */
            jadwal: jadwalPerChannel.get(c.id) ?? [],
            isMember: c.statusKeanggotaan === "aktif",
            isManager: c.statusKeanggotaan === "aktif" && c.isPengurus === true,
          })),
          /* Supaya layar bisa menjelaskan kenapa jaraknya kosong, alih-alih
             menampilkan "— m" tanpa sebab. */
          titikAlamatAda: lat !== null,
        };
      },
      { query: t.Object({ q: t.Optional(t.String({ maxLength: 60 })) }) },
    )

    /**
     * Ajukan gabung ke sebuah channel.
     *
     * Masuk sebagai `menunggu`, bukan langsung aktif: pengurus yang memutuskan
     * siapa warganya. Channel RT/RW adalah daftar nama dan rumah tetangga —
     * gabung otomatis berarti siapa pun bisa membacanya.
     */
    .post(
      "/:id/gabung",
      async ({ penggunaId, params }) => {
        const [channel] = await db
          .select({ id: rwChannels.id, name: rwChannels.name })
          .from(rwChannels)
          .where(eq(rwChannels.id, params.id));
        if (!channel) return status(404, { pesan: "Channel tidak ditemukan." });

        try {
          const [anggota] = await db
            .insert(channelMembers)
            .values({ channelId: channel.id, userId: penggunaId })
            .returning({
              id: channelMembers.id,
              status: channelMembers.status,
            });

          return status(201, {
            pesan: `Permintaan gabung ${channel.name} terkirim. Tunggu persetujuan pengurus.`,
            data: anggota,
          });
        } catch (e) {
          /* Sudah pernah mengajukan. Jawabannya menyertakan status sekarang —
             "sudah ada" saja membuat layar tidak tahu harus menampilkan
             "Menunggu persetujuan" atau "Channelmu". */
          if (bentrokDengan(e, "channel_members_unik_idx")) {
            const [ada] = await db
              .select({ status: channelMembers.status })
              .from(channelMembers)
              .where(
                and(
                  eq(channelMembers.channelId, channel.id),
                  eq(channelMembers.userId, penggunaId),
                ),
              );
            return status(409, {
              pesan:
                ada?.status === "aktif"
                  ? "Kamu sudah jadi anggota channel ini."
                  : "Permintaanmu sudah terkirim. Masih menunggu persetujuan pengurus.",
              data: { status: ada?.status ?? "menunggu" },
            });
          }
          throw e;
        }
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    )
    /**
     * Detail satu channel: jadwal angkut, info pengurus, pengumuman terbaru.
     *
     * Terbuka untuk siapa pun yang sudah masuk, bukan hanya anggotanya: layar
     * inilah yang dibaca warga SEBELUM memutuskan gabung, dan jadwal angkut RW
     * memang bukan rahasia.
     *
     * Yang ditahan hanya pengumumannya. Isinya menyebut kebiasaan rumah warga
     * ("karung di pos ronda"), jadi ia hanya dikirim ke anggota aktif —
     * bukan ke siapa pun yang menebak id channel.
     */
    .get(
      "/:id",
      async ({ penggunaId, params }) => {
        const [acuan] = await db
          .select({ lat: addresses.latitude, lng: addresses.longitude })
          .from(addresses)
          .where(
            and(eq(addresses.userId, penggunaId), isNotNull(addresses.latitude)),
          )
          .orderBy(sql`${addresses.isDefault} desc`, addresses.createdAt)
          .limit(1);
        const lat = acuan?.lat ?? null;
        const lng = acuan?.lng ?? null;

        const [channel] = await db
          .select({
            id: rwChannels.id,
            name: rwChannels.name,
            rtNumber: rwChannels.rtNumber,
            rwNumber: rwChannels.rwNumber,
            kelurahan: rwChannels.kelurahan,
            areaCode: rwChannels.areaCode,
            jarakM: jarakMeter(lat, lng),
            memberCount: jumlahAnggota,
            pengurus: namaPengurus,
            statusKeanggotaan: channelMembers.status,
            isPengurus: channelMembers.isPengurus,
          })
          .from(rwChannels)
          .leftJoin(
            channelMembers,
            and(
              eq(channelMembers.channelId, rwChannels.id),
              eq(channelMembers.userId, penggunaId),
            ),
          )
          .where(eq(rwChannels.id, params.id));

        if (!channel) return status(404, { pesan: "Channel tidak ditemukan." });

        const isMember = channel.statusKeanggotaan === "aktif";
        const isManager = isMember && channel.isPengurus === true;
        const jadwal = await pilihJadwal(db, channel.id);

        /* Pengumuman hanya untuk anggota. Jumlahnya pun tidak dibocorkan ke
           yang bukan anggota — "12 pengumuman" sudah memberi tahu seberapa
           sibuk RW itu kepada orang yang tidak berhak membacanya. */
        const pengumuman = isMember ? await pilihPengumuman(db, channel.id) : [];

        /* Antrean persetujuan: angka ini hanya ada di layar pengurus. */
        let menungguPersetujuan: number | null = null;
        if (isManager) {
          const [{ n }] = await db
            .select({ n: sql<number>`count(*)::int` })
            .from(channelMembers)
            .where(
              and(
                eq(channelMembers.channelId, channel.id),
                eq(channelMembers.status, "menunggu"),
              ),
            );
          menungguPersetujuan = n;
        }

        return {
          data: {
            ...channel,
            isMember,
            isManager,
            jadwal,
            /* Layar channel hanya mencetak yang terbaru, tapi juga perlu tahu
               ada berapa seluruhnya untuk tautan "Semua 12". */
            pengumumanTerbaru: pengumuman[0] ?? null,
            jumlahPengumuman: pengumuman.length,
            menungguPersetujuan,
          },
          titikAlamatAda: lat !== null,
        };
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    )

    /**
     * Seluruh pengumuman satu channel, terbaru di atas.
     *
     * Anggota aktif saja — alasannya sama seperti di detail. Yang masih
     * menunggu persetujuan dijawab 403 dengan sebabnya, bukan 404: ia tahu
     * channel-nya ada, yang belum ada izinnya.
     */
    .get(
      "/:id/pengumuman",
      async ({ penggunaId, params }) => {
        const [anggota] = await db
          .select({ status: channelMembers.status })
          .from(rwChannels)
          .leftJoin(
            channelMembers,
            and(
              eq(channelMembers.channelId, rwChannels.id),
              eq(channelMembers.userId, penggunaId),
            ),
          )
          .where(eq(rwChannels.id, params.id));

        if (!anggota) return status(404, { pesan: "Channel tidak ditemukan." });
        if (anggota.status !== "aktif") {
          return status(403, {
            pesan:
              anggota.status === "menunggu"
                ? "Permintaan gabungmu masih menunggu persetujuan pengurus."
                : "Gabung channel ini dulu untuk membaca pengumuman pengurus.",
          });
        }

        return { data: await pilihPengumuman(db, params.id) };
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    );
