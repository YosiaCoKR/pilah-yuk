import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { bentrokDengan } from "../galat";
import { payments, subscriptionPlans, subscriptions } from "../db/schema";
import { geserHari, lamaPeriode, ringkasLangganan } from "../langganan";
import { GalatBayar, type Gateway, badanCharge } from "../pembayaran";

const BadanBayar = t.Object({
  planId: t.String({ format: "uuid" }),
  method: t.Union([
    t.Literal("qris"),
    t.Literal("ewallet"),
    t.Literal("va_bank"),
  ]),
  /* Nama kanalnya: "GoPay", "BCA". QRIS tidak punya. */
  channel: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
});

/** PY-INV-#### — kode yang disebut warga saat menanyakan pembayarannya. */
const buatKodeTagihan = () =>
  `PY-INV-${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * Riwayat hanya memuat yang `paid` dan `failed`.
 *
 * `pending` adalah tagihan yang sedang dibayar — tempatnya di layar bayar,
 * bukan di riwayat; mencantumkannya di situ membuat warga mengira sudah
 * membayar. `expired` adalah pilihan yang ditinggalkan warga sebelum
 * membayar: tidak pernah ada uangnya, dan mencetaknya sebagai "gagal" akan
 * membuat warga mencari saldo yang tidak pernah terpotong.
 */
const TERCATAT = ["paid", "failed"] as const;

/**
 * Kanal bayar seperti yang DIBACA warga, bukan seperti yang disimpan.
 *
 * `method` + `channel` dua kolom, tapi di struk warga mengenalinya sebagai
 * satu kalimat ("Transfer BCA"). Dirangkai di server supaya kuitansi yang
 * dirakit layar dan baris yang tampil di daftar menyebut hal yang sama.
 */
const labelMetode = (metode: string, channel: string | null) =>
  metode === "qris"
    ? "QRIS"
    : metode === "va_bank"
      ? `Transfer ${channel ?? "bank"}`
      : (channel ?? "E-wallet");

/**
 * Baris tagihan + nama paket yang DITAGIH.
 *
 * Satu fungsi untuk daftar dan detail: bedanya hanya saringannya, dan join
 * yang disalin dua kali adalah join yang kelak berbeda di satu tempat saja.
 */
const pilihTagihan = (db: Db, saring: SQL | undefined) =>
  db
    .select({
      id: payments.id,
      code: payments.code,
      amount: payments.amount,
      method: payments.method,
      channel: payments.channel,
      status: payments.status,
      periodStart: payments.periodStart,
      periodEnd: payments.periodEnd,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      failureReason: payments.failureReason,
      planName: subscriptionPlans.name,
    })
    .from(payments)
    .innerJoin(subscriptionPlans, eq(payments.planId, subscriptionPlans.id))
    .where(saring)
    /* Percobaan terbaru lebih dulu — index `payments_user_dibuat_idx` memang
       dibuat untuk urutan ini. */
    .orderBy(desc(payments.createdAt));

type BarisTagihan = Awaited<ReturnType<typeof pilihTagihan>>[number];

/**
 * Tanggal panjang Indonesia: "1 November 2026".
 *
 * Zona Jakarta disebut eksplisit — tanpa itu tanggalnya ikut zona mesin
 * server, dan kuitansi yang dibuat jam 7 pagi WIB bisa tercetak tanggal
 * sebelumnya kalau servernya berjalan di UTC.
 */
const tanggalPenuh = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso));

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const barisKuitansi = (label: string, nilai: string) =>
  `${label.padEnd(10)}: ${nilai}`;

/**
 * Kuitansi langganan sebagai teks biasa.
 *
 * Teks, bukan PDF: warga mengirimnya lewat WhatsApp ke pengurus RW, dan di
 * sana teks langsung terbaca di gelembung pesan tanpa pembaca PDF. Bentuknya
 * sengaja sama dengan tanda terima pengangkutan (`teksBukti` di riwayat.ts).
 *
 * Bedanya dari kuitansi yang dirakit layar: angkanya datang dari basis data,
 * bukan dari keadaan layar — jadi inilah berkas yang bisa dipertanggung-
 * jawabkan kalau pembayaran warga perlu dicocokkan dengan pengurus.
 *
 * Tagihan GAGAL pun punya kuitansi. Justru itu yang dibawa warga saat
 * saldonya terlanjur berkurang padahal langganannya tidak jalan, jadi
 * sebabnya ikut tercetak dan "Tanggal" di situ berarti kapan percobaannya.
 */
function teksKuitansi(t: ReturnType<typeof bentukTagihan>) {
  const lunas = t.status === "lunas";
  return [
    "KUITANSI LANGGANAN",
    "Pilah Yuk",
    "",
    barisKuitansi("Kode", t.code),
    barisKuitansi("Paket", t.planName),
    barisKuitansi(
      "Masa",
      `${tanggalPenuh(t.periodStart)} sampai ${tanggalPenuh(t.periodEnd)}`,
    ),
    barisKuitansi("Jumlah", rupiah(t.amount)),
    barisKuitansi("Cara bayar", t.method),
    barisKuitansi(lunas ? "Tanggal" : "Dicoba", tanggalPenuh(t.paidAt)),
    barisKuitansi("Status", lunas ? "Lunas" : "Gagal"),
    /* null, bukan "" — baris kosong di atas memang pemisah yang disengaja,
       jadi hanya baris opsional yang boleh hilang. */
    t.failureReason ? barisKuitansi("Sebab", t.failureReason) : null,
    "",
    `Diterbitkan ${tanggalPenuh(new Date().toISOString())} oleh aplikasi Pilah Yuk.`,
  ]
    .filter((baris) => baris !== null)
    .join("\n");
}

/** Bentuk yang dibaca layar riwayat & detail pembayaran. */
function bentukTagihan(b: BarisTagihan) {
  const lunas = b.status === "paid";
  return {
    id: b.id,
    code: b.code,
    planName: b.planName,
    amount: b.amount,
    method: labelMetode(b.method, b.channel),
    /* Tagihan gagal tidak punya tanggal bayar — yang dicari warga di situ
       adalah KAPAN percobaannya, dan itu tanggal tagihannya dibuat. */
    paidAt: (lunas ? b.paidAt! : b.createdAt).toISOString(),
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
    status: lunas ? ("lunas" as const) : ("gagal" as const),
    /* Hanya terisi saat gagal: sebab pada tagihan lunas akan dibaca warga
       sebagai tanda ada yang salah dengan pembayaran yang berhasil. Sebab
       pada tagihan `expired` memang ada (lihat jalur /bayar), tapi barisnya
       tidak pernah sampai ke sini. */
    failureReason: lunas ? undefined : (b.failureReason ?? undefined),
  };
}

export const ruteLangganan = (db: Db, gateway?: Gateway) =>
  new Elysia({ prefix: "/langganan" })
    .use(auth)

    /**
     * Daftar paket yang ditawarkan, termurah lebih dulu.
     *
     * Urutan harga, bukan kolom urutan sendiri: tangganya memang harga, dan
     * layar langganan mencetak harga-per-jemput di tiap baris supaya warga
     * bisa membandingkan tanpa berhitung. Kolom `sort_order` di sini hanya
     * akan jadi tempat urutan dan harga bisa saling bertentangan.
     *
     * Paket yang sudah ditarik IKUT dikirim dengan `isActive: false`. Layarnya
     * menyebut alasannya ("armada RW kamu belum melayani paket sebesar ini")
     * alih-alih menyembunyikannya — paket yang hilang tanpa sebab akan
     * ditanyakan ke pengurus, dan warga yang masih memakai paket lama perlu
     * melihat miliknya tetap tercantum.
     */
    .get("/paket", async () => ({
      data: await db
        .select({
          id: subscriptionPlans.id,
          name: subscriptionPlans.name,
          billingCycle: subscriptionPlans.billingCycle,
          pickupQuota: subscriptionPlans.pickupQuota,
          price: subscriptionPlans.price,
          isActive: subscriptionPlans.isActive,
        })
        .from(subscriptionPlans)
        .orderBy(asc(subscriptionPlans.price)),
    }))

    .get("/saya", async ({ penggunaId }) => ({
      data: await ringkasLangganan(db, penggunaId),
    }))

    /**
     * Nyalakan/matikan perpanjangan otomatis.
     *
     * Terpisah dari "bayar" karena warga menekannya langsung dari sakelar di
     * layar langganan — mengubah pilihan ini tidak membuat tagihan dan tidak
     * menggeser tanggal apa pun.
     *
     * Barisnya diambil dari `ringkasLangganan`, bukan dicari sendiri: warga
     * boleh punya langganan aktif DAN satu baris menunggu bayar sekaligus,
     * dan yang dimaksud sakelar itu adalah langganan yang BERLAKU. Memilih
     * baris terbaru akan menyetel perpanjangan pada paket yang belum tentu
     * jadi dibeli.
     *
     * ponytail: ini baru menyimpan pilihannya. Yang benar-benar menagih di
     * tanggal berakhir adalah job perpanjangan — belum ada, jadi langganan
     * dengan `autoRenew: true` tetap kedaluwarsa kalau tidak dibayar manual.
     * Lihat juga `ringkasLangganan`, yang sudah memperlakukan tanggal sebagai
     * penentu, bukan kolom status.
     */
    .put(
      "/perpanjang-otomatis",
      async ({ penggunaId, body }) => {
        const langganan = await ringkasLangganan(db, penggunaId);
        if (!langganan.id) {
          return status(404, {
            pesan: "Belum ada langganan. Pilih paket dulu.",
          });
        }

        const [baris] = await db
          .update(subscriptions)
          .set({ autoRenew: body.aktif, updatedAt: new Date() })
          .where(eq(subscriptions.id, langganan.id))
          .returning({
            id: subscriptions.id,
            autoRenew: subscriptions.autoRenew,
          });

        return { data: { id: baris.id, autoRenew: baris.autoRenew } };
      },
      { body: t.Object({ aktif: t.Boolean() }) },
    )

    /**
     * Riwayat pembayaran warga, percobaan terbaru lebih dulu.
     *
     * Dikembalikan utuh tanpa halaman: layar riwayat menjumlahkan sendiri
     * "total dibayar" dari baris yang lunas, dan jumlah itu salah kalau
     * servernya cuma mengirim sepotong. Satu warga paling banyak punya 12–52
     * baris setahun, jadi belum ada yang perlu dipotong.
     *
     * `planName` ikut dari baris paket yang DITAGIH, bukan dari paket
     * langganan sekarang — kuitansi lama harus tetap menyebut paket yang
     * dibayar waktu itu meski warga sudah pindah paket.
     */
    .get("/tagihan", async ({ penggunaId }) => ({
      data: (
        await pilihTagihan(
          db,
          and(
            eq(payments.userId, penggunaId),
            inArray(payments.status, TERCATAT),
          ),
        )
      ).map(bentukTagihan),
    }))

    /**
     * Satu tagihan, untuk layar detail & kuitansi.
     *
     * Tagihan warga lain dijawab 404, bukan 403: nominal dan kanal bayar
     * orang lain tidak boleh bisa dipastikan keberadaannya dengan menebak id.
     * Tagihan `pending`/`expired` juga 404 — sama alasannya dengan daftar di
     * atas, dan supaya tautan ke detail tidak pernah mencetak struk untuk
     * uang yang belum masuk.
     */
    .get(
      "/tagihan/:id",
      async ({ penggunaId, params }) => {
        const [baris] = await pilihTagihan(
          db,
          and(
            eq(payments.id, params.id),
            eq(payments.userId, penggunaId),
            inArray(payments.status, TERCATAT),
          ),
        );

        if (!baris) return status(404, { pesan: "Tagihan tidak ditemukan." });
        return { data: bentukTagihan(baris) };
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    )

    /**
     * Kuitansi satu tagihan sebagai berkas teks.
     *
     * Dikirim sebagai lampiran, bukan JSON, supaya tautannya bisa dibuka
     * langsung dari peramban — tidak ada kode di sisi warga yang perlu
     * merakit berkas lagi, dan angkanya tidak bisa berbeda dari yang
     * tercatat.
     *
     * Saringannya sama dengan detail: milik sendiri, dan hanya yang `paid`
     * atau `failed`. Kuitansi untuk tagihan yang belum dibayar adalah bukti
     * palsu bahwa uangnya sudah masuk.
     */
    .get(
      "/tagihan/:id/kuitansi",
      async ({ penggunaId, params, set }) => {
        const [baris] = await pilihTagihan(
          db,
          and(
            eq(payments.id, params.id),
            eq(payments.userId, penggunaId),
            inArray(payments.status, TERCATAT),
          ),
        );

        if (!baris) return status(404, { pesan: "Tagihan tidak ditemukan." });

        const tagihan = bentukTagihan(baris);
        /* Kode datang dari basis data, tapi tetap dibersihkan: apa pun yang
           masuk ke header tidak boleh bisa menyelundupkan tanda kutip atau
           ganti baris. */
        const nama = `kuitansi-${tagihan.code.replace(/[^\w.-]/g, "")}.txt`;
        set.headers["content-type"] = "text/plain; charset=utf-8";
        set.headers["content-disposition"] = `attachment; filename="${nama}"`;
        return teksKuitansi(tagihan);
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }) },
    )

    /**
     * Buat tagihan untuk satu paket.
     *
     * Yang TIDAK datang dari pemanggil: nominalnya. Harga dibaca dari baris
     * paket di basis data, karena jumlah yang dikirim klien adalah jumlah yang
     * bisa diubah klien — satu baris curl sudah cukup untuk berlangganan paket
     * terbesar seharga seribu rupiah.
     *
     * Belum memanggil penyedia pembayaran. Tagihannya berdiri dulu di basis
     * data dengan status `pending`; kode QRIS, nomor VA, dan `provider_ref`
     * menyusul di task integrasi gateway, lalu webhook-nya yang memindahkan
     * status ke `paid`.
     *
     * ponytail: tanpa gateway, tagihan `pending` tidak punya batas waktu —
     * yang kedaluwarsa hanya tagihan lama saat warga membuat yang baru. Begitu
     * penyedia terpasang, `expires_at` datang dari dia, bukan dari sini.
     */
    .post(
      "/bayar",
      async ({ penggunaId, body }) => {
        const channel = body.channel?.trim() || null;
        /* QRIS dipindai dari aplikasi apa pun, jadi kanal di situ tidak punya
           arti; e-wallet dan VA justru tidak bisa dibuat tanpa kanal. */
        if (body.method === "qris" && channel) {
          return status(422, {
            pesan: "QRIS tidak perlu pilihan aplikasi atau bank.",
          });
        }
        if (body.method !== "qris" && !channel) {
          return status(422, {
            pesan:
              body.method === "ewallet"
                ? "Pilih dulu aplikasi e-wallet-nya."
                : "Pilih dulu banknya.",
          });
        }

        /* Gagal tertutup. Tanpa penyedia, tidak ada tagihan yang dibuat —
           baris `pending` yang tidak pernah bisa dibayar hanya akan menutup
           tagihan berikutnya lewat index satu-menggantung. */
        if (!gateway) {
          return status(503, {
            pesan:
              "Pembayaran belum tersambung. Hubungi pengurus RW dulu, ya.",
          });
        }

        const [paket] = await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, body.planId));
        if (!paket) return status(404, { pesan: "Paket tidak ditemukan." });

        const langganan = await ringkasLangganan(db, penggunaId);

        /* Paket yang sudah ditarik masih boleh DIPERPANJANG oleh warga yang
           memakainya — layar langganannya memang menawarkan itu. Yang ditutup
           adalah pintu masuknya bagi warga baru. */
        if (!paket.isActive && langganan.planId !== paket.id) {
          return status(409, {
            pesan: "Paket ini sudah tidak ditawarkan lagi. Pilih paket lain.",
          });
        }

        /* Kanal diperiksa SEBELUM menulis: `badanCharge` murni, dan kanal
           yang tidak dilayani Core API (Mandiri, OVO, DANA) sebaiknya ditolak
           tanpa meninggalkan tagihan gagal di riwayat warga. */
        try {
          badanCharge({
            code: "PY-INV-0000",
            amount: paket.price,
            method: body.method,
            channel,
          });
        } catch (e) {
          if (e instanceof GalatBayar) return status(422, { pesan: e.pesan });
          throw e;
        }

        const hariIni = new Date().toISOString().slice(0, 10);
        /* Perpanjang lebih awal: periode baru disambung dari tanggal berakhir,
           bukan dari hari ini — menyetelnya ke hari ini menghanguskan sisa
           hari yang sudah dibayar warga. */
        const perpanjang =
          langganan.status === "aktif" &&
          langganan.planId === paket.id &&
          langganan.endDate !== null &&
          langganan.endDate > hariIni;
        const mulai = perpanjang ? langganan.endDate! : hariIni;
        const akhir = geserHari(mulai, lamaPeriode(paket.billingCycle));

        /*
          Tagihan lama dimatikan DI PENYEDIA lebih dulu, bukan hanya ditandai
          `expired` di basis data.

          Menandainya di sini saja adalah separuh pekerjaan: kode QRIS-nya
          tetap hidup di Midtrans, dan warga yang memindainya tetap membayar
          tagihan yang sudah tidak berlaku. Dipanggil di luar transaksi karena
          ini panggilan jaringan.

          Kalau penyedia tidak bisa dihubungi, pembuatan tagihan baru TIDAK
          diblokir — warga tidak boleh tersangkut karena gangguan di sana.
          Yang menahan akibatnya adalah penjaga di webhook: tagihan yang tidak
          lagi `pending` tidak mengaktifkan apa pun.
        */
        const menggantung = await db
          .select({ id: payments.id, code: payments.code })
          .from(payments)
          .where(
            and(eq(payments.userId, penggunaId), eq(payments.status, "pending")),
          );

        const gagalDimatikan: string[] = [];
        for (const lama of menggantung) {
          try {
            await gateway.batalkan(lama.code);
          } catch {
            gagalDimatikan.push(lama.id);
          }
        }

        try {
          const tagihan = await db.transaction(async (tx) => {
            /* Perpanjangan menempel ke langganan yang sedang berjalan: pada
               pembayaran nanti yang berubah hanya tanggal berakhirnya. Baris
               `aktif` kedua tidak mungkin dibuat — satu per warga. */
            let langgananId = perpanjang ? langganan.id! : null;

            if (!langgananId) {
              /* Ganti paket / langganan pertama: barisnya menunggu bayar
                 dulu. Yang sudah menggantung DIPERBARUI, bukan ditambah —
                 satu tagihan menggantung per warga. */
              const [menunggu] = await tx
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(
                  and(
                    eq(subscriptions.userId, penggunaId),
                    eq(subscriptions.status, "menunggu_bayar"),
                  ),
                );

              if (menunggu) {
                await tx
                  .update(subscriptions)
                  .set({
                    planId: paket.id,
                    startDate: mulai,
                    endDate: akhir,
                    updatedAt: new Date(),
                  })
                  .where(eq(subscriptions.id, menunggu.id));
                langgananId = menunggu.id;
              } else {
                const [baru] = await tx
                  .insert(subscriptions)
                  .values({
                    userId: penggunaId,
                    planId: paket.id,
                    status: "menunggu_bayar",
                    startDate: mulai,
                    endDate: akhir,
                  })
                  .returning({ id: subscriptions.id });
                langgananId = baru.id;
              }
            }

            /* Tagihan lama yang masih menggantung ditutup. Kalau tidak, kode
               QRIS dari pilihan yang sudah ditinggalkan warga tetap hidup —
               dan yang membayarnya akan membayar paket yang tidak lagi
               dipilihnya. */
            await tx
              .update(payments)
              .set({ status: "expired" })
              .where(
                and(
                  eq(payments.userId, penggunaId),
                  eq(payments.status, "pending"),
                ),
              );

            /* Yang tidak berhasil dimatikan di penyedia ditandai, supaya kalau
               uangnya tetap masuk nanti ada jejak yang bisa dicari pengurus. */
            if (gagalDimatikan.length > 0) {
              await tx
                .update(payments)
                .set({
                  failureReason:
                    "Ditinggalkan warga, tapi gagal dimatikan di penyedia — kalau terbayar, perlu pengembalian dana.",
                })
                .where(inArray(payments.id, gagalDimatikan));
            }

            const [baru] = await tx
              .insert(payments)
              .values({
                code: buatKodeTagihan(),
                userId: penggunaId,
                subscriptionId: langgananId,
                planId: paket.id,
                /* Dari basis data, bukan dari pemanggil. */
                amount: paket.price,
                method: body.method,
                channel,
                periodStart: mulai,
                periodEnd: akhir,
              })
              .returning();

            return baru;
          });

          /* Penyedia dipanggil DI LUAR transaksi: panggilan jaringan 15 detik
             di dalamnya akan menahan satu koneksi basis data selama itu, dan
             kolam koneksi Supabase tidak besar. */
          let hasil;
          try {
            hasil = await gateway.tagih({
              code: tagihan.code,
              amount: tagihan.amount,
              method: tagihan.method,
              channel: tagihan.channel,
            });
          } catch (e) {
            if (!(e instanceof GalatBayar)) throw e;
            /* Sebabnya disimpan di barisnya: inilah yang dibaca warga di layar
               riwayat, dan yang dibawanya ke pengurus kalau saldonya terlanjur
               berkurang. */
            await db
              .update(payments)
              .set({ status: "failed", failureReason: e.pesan })
              .where(eq(payments.id, tagihan.id));
            return status(e.salahPilihan ? 422 : 502, { pesan: e.pesan });
          }

          const [siap] = await db
            .update(payments)
            .set({ providerRef: hasil.providerRef })
            .where(eq(payments.id, tagihan.id))
            .returning();

          return status(201, {
            data: {
              id: siap.id,
              code: siap.code,
              amount: siap.amount,
              method: siap.method,
              channel: siap.channel,
              status: siap.status,
              periodStart: siap.periodStart,
              periodEnd: siap.periodEnd,
              planName: paket.name,
              /* Perpanjangan tidak menggeser tanggal mulai; warga perlu tahu
                 kapan periode yang dibayarnya ini berjalan. */
              perpanjangan: perpanjang,
              /* Instruksi bayar dari penyedia. Satu di antaranya terisi,
                 sesuai metodenya — layar bayar membaca yang sesuai.

                 ponytail: hanya dikembalikan di jawaban ini, tidak disimpan.
                 Warga yang memuat ulang halaman bayar kehilangan nomor VA-nya;
                 kolom penyimpannya menyusul bersama API status pembayaran. */
              qrUrl: hasil.qrUrl,
              vaNumber: hasil.vaNumber,
              deeplink: hasil.deeplink,
            },
          });
        } catch (e) {
          /* Kode 4 digit acak — sesekali bisa kembar. */
          if (bentrokDengan(e, "payments_code_idx")) {
            return status(409, {
              pesan: "Kode tagihan bentrok. Coba kirim sekali lagi.",
            });
          }
          /* Dua permintaan bayar datang bersamaan: yang kalah mengulang. */
          if (bentrokDengan(e, "subscriptions_satu_menunggu_idx")) {
            return status(409, {
              pesan: "Ada tagihan yang sedang dibuat. Coba sebentar lagi.",
            });
          }
          throw e;
        }
      },
      { body: BadanBayar },
    );
