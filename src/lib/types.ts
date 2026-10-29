/* Shapes mirror the Supabase schema in the PRD so the backend layer can
   drop in later without touching the components. */

export type WasteKey = "organik" | "plastik" | "kertas" | "campuran";

export type WasteCategory = {
  key: WasteKey;
  name: string;
  description: string;
  handlingTip: string;
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
  endDate: string; // ISO date
  pickupQuota: number;
  pickupUsed: number;
  price: number;
  autoRenew: boolean;
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
