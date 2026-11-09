import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "./db";
import { pickups, subscriptionPlans, subscriptions } from "./db/schema";

/** Lama satu periode paket, dalam hari. */
export const lamaPeriode = (siklus: "mingguan" | "bulanan") =>
  siklus === "mingguan" ? 7 : 30;

/** ISO yyyy-mm-dd, `hari` setelah `mulaiISO`. UTC supaya tidak bergeser. */
export function geserHari(mulaiISO: string, hari: number) {
  return new Date(Date.parse(mulaiISO) + hari * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export type RingkasanLangganan = {
  /** null saat warga belum pernah berlangganan. */
  id: string | null;
  planId: string | null;
  status: "aktif" | "kedaluwarsa" | "menunggu_bayar" | "belum_ada";
  planName: string | null;
  billingCycle: "mingguan" | "bulanan" | null;
  price: number | null;
  /* Dua-duanya dikirim: layar status mencetak periodenya sebagai rentang
     ("1 Nov – 1 Des"), dan tanggal mulai itu juga yang dipakai menghitung
     kuota, jadi klien tidak perlu menduganya dari siklus paket. */
  startDate: string | null;
  endDate: string | null;
  pickupQuota: number | null;
  pickupUsed: number;
  autoRenew: boolean;
  /**
   * Paket berjalan: status `aktif` DAN tanggalnya belum lewat. Kuota tidak
   * dihitung.
   *
   * Terpisah dari `bolehPesan` karena tidak semua yang dijaga gerbang
   * langganan memakai kuota hari ini: jadwal rutin berlaku untuk
   * periode-periode BERIKUTNYA, jadi kuota yang habis hari ini tidak
   * membuatnya sia-sia. Tanpa bendera ini, layar yang menjaga jadwal rutin
   * harus menghitung ulang aturannya dari status + kuota — dan aturan yang
   * dihitung dua kali adalah aturan yang kelak berbeda di satu tempat.
   */
  langgananAktif: boolean;
  /** Satu-satunya hal yang perlu dicek rute lain sebelum menerima pesanan. */
  bolehPesan: boolean;
  /** Kenapa `bolehPesan` false. null saat memang boleh memesan. */
  alasan: string | null;
};

/**
 * Keadaan langganan seorang warga.
 *
 * Sumbernya baris `subscriptions` terbaru, tapi status "aktif" juga harus
 * lolos tanggal: baris bisa saja masih bertuliskan aktif sementara
 * `end_date`-nya sudah lewat karena job perpanjangan belum jalan. Tanggal
 * yang menentukan, bukan kolom status.
 */
export async function ringkasLangganan(
  db: Db,
  penggunaId: string,
): Promise<RingkasanLangganan> {
  const hariIni = new Date().toISOString().slice(0, 10);

  const [baris] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      endDate: subscriptions.endDate,
      startDate: subscriptions.startDate,
      planId: subscriptions.planId,
      autoRenew: subscriptions.autoRenew,
      planName: subscriptionPlans.name,
      billingCycle: subscriptionPlans.billingCycle,
      price: subscriptionPlans.price,
      pickupQuota: subscriptionPlans.pickupQuota,
    })
    .from(subscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(subscriptions.planId, subscriptionPlans.id),
    )
    .where(eq(subscriptions.userId, penggunaId))
    /*
      Langganan yang BERLAKU lebih dulu, baru yang terbaru.
      
      Sejak warga boleh punya langganan aktif DAN satu tagihan menggantung,
      urutan `end_date desc` saja memilih baris yang menunggu bayar — periode
      barunya memang berakhir paling belakang. Akibatnya warga yang baru
      memilih paket lain dilaporkan `menunggu_bayar` dan kehilangan hak jemput
      di hari-hari yang sudah dibayarnya, justru yang dihindari dengan
      memisahkan barisnya.
    */
    .orderBy(
      sql`(${subscriptions.status} = 'aktif'
           and ${subscriptions.endDate} >= current_date) desc`,
      sql`${subscriptions.endDate} desc`,
    )
    .limit(1);

  if (!baris) {
    return {
      id: null,
      planId: null,
      status: "belum_ada",
      planName: null,
      billingCycle: null,
      price: null,
      startDate: null,
      endDate: null,
      pickupQuota: null,
      pickupUsed: 0,
      autoRenew: false,
      langgananAktif: false,
      bolehPesan: false,
      alasan: "Belum ada langganan. Pilih paket dulu untuk mulai memesan.",
    };
  }

  const lewatTanggal = baris.endDate < hariIni;
  const status: RingkasanLangganan["status"] =
    baris.status === "aktif" && lewatTanggal ? "kedaluwarsa" : baris.status;

  /* Kuota dihitung dari pesanan dalam periode langganan berjalan. Pesanan
     batal tidak dihitung — warga tidak boleh rugi karena membatalkan. */
  const [{ terpakai }] = await db
    .select({
      terpakai: sql<number>`count(*) filter (
        where ${pickups.status} <> 'batal'
      )::int`,
    })
    .from(pickups)
    .where(
      and(
        eq(pickups.userId, penggunaId),
        gte(pickups.pickupDate, baris.startDate),
        sql`${pickups.pickupDate} <= ${baris.endDate}`,
      ),
    );

  const kuotaHabis = terpakai >= baris.pickupQuota;

  const alasan =
    status === "menunggu_bayar"
      ? "Pembayaran belum selesai. Selesaikan dulu supaya jemput bisa dijadwalkan."
      : status === "kedaluwarsa"
        ? "Langganan sudah habis. Perpanjang dulu supaya petugas bisa menjemput lagi."
        : kuotaHabis
          ? "Kuota jemput paket ini sudah terpakai semua."
          : null;

  return {
    id: baris.id,
    planId: baris.planId,
    status,
    planName: baris.planName,
    billingCycle: baris.billingCycle,
    price: baris.price,
    startDate: baris.startDate,
    endDate: baris.endDate,
    pickupQuota: baris.pickupQuota,
    pickupUsed: terpakai,
    autoRenew: baris.autoRenew,
    langgananAktif: status === "aktif",
    bolehPesan: status === "aktif" && !kuotaHabis,
    alasan,
  };
}
