/* Shapes mirror the Supabase schema in the PRD so the backend layer can
   drop in later without touching the components. */

export type WasteKey = "organik" | "plastik" | "kertas" | "campuran";

export type WasteCategory = {
  key: WasteKey;
  name: string;
  description: string;
  handlingTip: string;
};

/**
 * Satu benda sehari-hari dan tong tujuannya. Dipakai dua-duanya: contoh di
 * kartu jenis dan hasil pencarian — satu daftar, jadi keduanya tidak mungkin
 * saling bertentangan.
 */
export type WasteItem = {
  nama: string;
  jenis: WasteKey;
  /** Alasan singkat, hanya untuk benda yang jawabannya bikin kaget. */
  catatan?: string;
  /** Ikut tampil sebagai contoh di kartu jenis: yang paling sering bikin ragu. */
  sorot?: boolean;
};

export type Address = {
  id: string;
  label: string;
  fullAddress: string;
  landmark: string;
  rwChannelName: string;
  isDefault: boolean;
};

export type TimeSlot = {
  id: string;
  range: string;
  note: string;
  full?: boolean;
};

export type PickupStatus = "menunggu" | "dijemput" | "selesai" | "batal";

export type Pickup = {
  id: string;
  code: string;
  addressId: string;
  pickupDate: string; // ISO date
  timeSlotId: string;
  categories: WasteKey[];
  status: PickupStatus;
  totalWeightKg?: number;
  officerName?: string;
  notes?: string;
  recurring?: boolean;
};

/** A pickup order being assembled, before it is sent. */
export type DraftOrder = {
  addressId: string | null;
  categories: WasteKey[];
  date: string | null;
  timeSlotId: string | null;
  notes: string;
};

export type SubscriptionStatus = "aktif" | "kedaluwarsa" | "menunggu_bayar";

export type Subscription = {
  id: string;
  planName: string;
  billingCycle: "mingguan" | "bulanan";
  status: SubscriptionStatus;
  /** Awal periode berjalan. ISO date. */
  startDate: string;
  endDate: string; // ISO date
  pickupQuota: number;
  pickupUsed: number;
  price: number;
  autoRenew: boolean;
};

/**
 * Paket langganan yang ditawarkan. Bentuknya sama dengan tabel
 * `subscription_plans` — tidak ada kolom hiasan yang nanti tidak bisa diisi
 * backend; kalimat "cocok untuk siapa" dihitung dari kuota, bukan disimpan.
 */
export type Plan = {
  id: string;
  name: string;
  billingCycle: "mingguan" | "bulanan";
  pickupQuota: number;
  price: number;
  /** Masih ditawarkan di wilayah warga. Paket lama tetap terbaca di sini
      supaya yang sudah terlanjur berlangganan tahu posisinya. */
  isActive: boolean;
};

/**
 * Satu tagihan langganan. Bentuknya mengikuti tabel `payments` yang menyusul:
 * jumlah, kanal bayar, dan kapan terbacanya.
 */
export type Invoice = {
  id: string;
  /** Kode yang disebut warga saat menanyakan pembayaran ke pengurus. */
  code: string;
  planName: string;
  amount: number;
  /** Kanal seperti yang dipilih warga: "QRIS", "GoPay", "Transfer BCA". */
  method: string;
  /** Tanggal ISO. Untuk tagihan gagal, kapan percobaannya. */
  paidAt: string;
  /** Masa langganan yang dibayar tagihan ini. ISO date. */
  periodStart: string;
  periodEnd: string;
  status: "lunas" | "gagal";
  /** Sebab gagalnya, dari kanal bayar. Hanya terisi saat status "gagal". */
  failureReason?: string;
};

export type Weekday =
  | "Senin"
  | "Selasa"
  | "Rabu"
  | "Kamis"
  | "Jumat"
  | "Sabtu"
  | "Minggu";

export type RecurringSchedule = {
  id: string;
  addressId: string;
  days: Weekday[];
  timeSlotId: string;
  startDate: string;
  endDate: string | null;
  isPaused: boolean;
  /** ISO date the pause lifts, when the warga set one. */
  pausedUntil: string | null;
  reminderEnabled: boolean;
  categories: WasteKey[];
};

export type Channel = {
  id: string;
  name: string;
  rtNumber: string;
  rwNumber: string;
  kelurahan: string;
  areaCode: string;
  scheduleInfo: string;
  memberCount: number;
  /** Jarak perkiraan dari alamat utama warga, dalam meter. */
  distanceM: number;
  pengurus: string;
  isMember: boolean;
  /** Benar bila warga yang masuk adalah pengurus channel ini. */
  isManager: boolean;
  /** Pengumuman terbaru, untuk pratinjau di daftar. */
  latestPost?: { author: string; content: string; agoDays: number };
};

/** Pengumuman pengurus di sebuah channel RT/RW. */
export type ChannelPost = {
  id: string;
  channelId: string;
  author: string;
  /** Jabatan penulis — membedakan pengurus dari warga biasa. */
  authorRole: string;
  title: string;
  content: string;
  /** Umur pengumuman dalam hari; 0 berarti hari ini. */
  agoDays: number;
};

/** Satu tulisan di papan diskusi warga — utas maupun balasannya. */
export type ChannelComment = {
  id: string;
  author: string;
  /** Diisi hanya untuk pengurus, supaya jawabannya terbaca resmi. */
  authorRole?: string;
  content: string;
  /** Umur tulisan dalam hari; 0 berarti hari ini. */
  agoDays: number;
};

export type ChannelThread = ChannelComment & {
  channelId: string;
  replies: ChannelComment[];
};

/** `menunggu` = sudah mengajukan gabung, belum disetujui pengurus. */
export type MemberStatus = "aktif" | "menunggu";

export type ChannelMember = {
  id: string;
  channelId: string;
  name: string;
  /** Patokan rumah, bukan alamat lengkap — cukup untuk dikenali pengurus. */
  houseLabel: string;
  status: MemberStatus;
  /** Umur keanggotaan atau permintaan, dalam hari. */
  agoDays: number;
  isPengurus?: boolean;
};
