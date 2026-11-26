/**
 * Data warga dari API, dalam bentuk yang dipakai komponen (src/lib/types.ts).
 * Hanya untuk Server Component — semua lewat `ambil`, jadi sesi diperiksa
 * API, bukan di sini.
 */
import { ambil } from "./api";
import { gabung, urutkanHari } from "./kalimat";
import type {
  Ulasan,
  Invoice,
  Plan,
  Address,
  Channel,
  ChannelMember,
  ChannelPost,
  ChannelThread,
  MemberStatus,
  Pickup,
  PickupStatus,
  RecurringSchedule,
  Subscription,
  TimeSlot,
  WasteKey,
  Weekday,
} from "./types";

/** Satu baris pesanan dari API (server/src/baris-pesanan.ts). */
type BarisPesanan = {
  id: string;
  code: string;
  status: PickupStatus;
  tanggal: string;
  jam: string | null;
  totalWeightKg?: string | null;
  officerName?: string | null;
  notes?: string | null;
  alamatLabel: string;
  alamatLengkap: string;
  alamatPatokan?: string | null;
  channelName: string | null;
  rutin?: boolean;
  jenis: string[];
};

export const kePickup = (b: BarisPesanan): Pickup => ({
  id: b.id,
  code: b.code,
  status: b.status,
  pickupDate: b.tanggal,
  address: {
    label: b.alamatLabel,
    fullAddress: b.alamatLengkap,
    landmark: b.alamatPatokan ?? "",
    rwChannelName: b.channelName ?? "",
  },
  slot: b.jam ? { range: b.jam } : undefined,
  categories: b.jenis as WasteKey[],
  /* numeric Postgres datang sebagai teks "6.40". */
  totalWeightKg: b.totalWeightKg == null ? undefined : Number(b.totalWeightKg),
  officerName: b.officerName ?? undefined,
  notes: b.notes ?? undefined,
  recurring: b.rutin ?? false,
});

/** Semua pesanan warga, semua status, terbaru dulu. */
export const semuaPesanan = async () =>
  (await ambil<BarisPesanan[]>("/api/pesanan"))?.map(kePickup) ?? [];

/** Yang belum lewat: menunggu/dijemput, terdekat dulu. */
export const pesananMendatang = async () =>
  (await ambil<BarisPesanan[]>("/api/jadwal/mendatang"))?.map(kePickup) ?? [];

/** Yang sudah berakhir: selesai/batal. */
export const riwayat = async () =>
  (await ambil<BarisPesanan[]>("/api/riwayat"))?.map(kePickup) ?? [];

export async function satuPesanan(id: string) {
  const b = await ambil<BarisPesanan & { petugasJumlahAngkut?: number }>(
    `/api/pesanan/${id}`,
  );
  /* Berapa kali petugas ini sudah mengangkut dari alamat yang sama. */
  return (
    b && { ...kePickup(b), petugasJumlahAngkut: b.petugasJumlahAngkut ?? 0 }
  );
}

/** Akun warga yang sedang masuk, bentuk yang dipakai layar profil. */
export type Akun = {
  nama: string;
  hp: string;
  email: string | null;
  peran: "warga" | "pengurus";
  /** ISO date. */
  bergabung: string;
};

export async function akunku(): Promise<Akun> {
  const p = await ambil<{
    fullName: string;
    phone: string | null;
    email: string | null;
    role: Akun["peran"];
    createdAt: string;
  }>("/api/profil");
  if (!p) throw new Error("Profil warga tidak ditemukan.");
  return {
    nama: p.fullName,
    hp: p.phone ?? "",
    email: p.email,
    peran: p.role,
    bergabung: p.createdAt.slice(0, 10),
  };
}

export const alamatku = async () =>
  (
    await ambil<(Address & { rwChannelName: string | null })[]>("/api/alamat")
  )?.map((a) => ({
    ...a,
    landmark: a.landmark ?? "",
    rwChannelName: a.rwChannelName ?? "",
  })) ?? [];

/** Slot jam untuk satu tanggal, lengkap dengan tanda penuh. */
export const slotWaktu = async (tanggal: string) =>
  (await ambil<TimeSlot[]>(`/api/slot-waktu?tanggal=${tanggal}`)) ?? [];

type BarisRutin = {
  id: string;
  timeSlotId: string;
  jam: string;
  alamatId: string;
  alamatLabel: string;
  alamatLengkap: string;
  alamatPatokan: string | null;
  channelName: string | null;
  mulai: string;
  sampai: string | null;
  dijeda: boolean;
  jedaSampai: string | null;
  pengingat: boolean;
  jenis: string[];
  hari: Weekday[];
};

/**
 * Jadwal rutin warga. API mengizinkan beberapa (satu per alamat & jam);
 * ponytail: layar baru mengenal satu — yang pertama dipakai. Tambah daftar
 * di halaman Jadwal kalau warga memang butuh lebih dari satu.
 */
export async function jadwalRutin(): Promise<RecurringSchedule | null> {
  const [j] = (await ambil<BarisRutin[]>("/api/jadwal/rutin")) ?? [];
  if (!j) return null;
  return {
    id: j.id,
    addressId: j.alamatId,
    address: {
      label: j.alamatLabel,
      fullAddress: j.alamatLengkap,
      landmark: j.alamatPatokan ?? "",
      rwChannelName: j.channelName ?? "",
    },
    timeSlotId: j.timeSlotId,
    slot: { range: j.jam },
    days: j.hari,
    startDate: j.mulai,
    endDate: j.sampai,
    isPaused: j.dijeda,
    pausedUntil: j.jedaSampai,
    reminderEnabled: j.pengingat,
    categories: j.jenis as WasteKey[],
  };
}

/** Langganan yang berlaku; `null` = belum pernah berlangganan. */
export async function langgananku(): Promise<Subscription | null> {
  const l = await ambil<Subscription & { id: string | null }>(
    "/api/langganan/saya",
  );
  return l?.id ? l : null;
}

/** Umur dalam hari dari stempel waktu API — "hari ini" = 0. */
const umurHari = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

const NAMA_HARI: Weekday[] = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

type BarisTulisan = {
  id: string;
  content: string;
  dibuatPada: string;
  author: string;
  authorRole: string | null;
};

type BarisChannel = {
  id: string;
  name: string;
  rtNumber: string | null;
  rwNumber: string | null;
  kelurahan: string | null;
  areaCode: string;
  jarakM: number | null;
  memberCount: number;
  pengurus: string | null;
  statusKeanggotaan: MemberStatus | null;
  isMember: boolean;
  isManager: boolean;
  jadwal: { days: number[]; jam: string }[];
  pengumumanTerbaru?: (BarisTulisan & { title: string }) | null;
  jumlahPengumuman?: number;
  menungguPersetujuan?: number | null;
};

const keChannel = (c: BarisChannel): Channel => ({
  id: c.id,
  name: c.name,
  rtNumber: c.rtNumber ?? "-",
  rwNumber: c.rwNumber ?? "-",
  kelurahan: c.kelurahan ?? "-",
  areaCode: c.areaCode,
  /* "Selasa & Jumat, 06.00–08.00" — perakit hari yang sama dengan jadwal
     rutin warga. */
  scheduleInfo:
    c.jadwal
      .map(
        (j) =>
          `${gabung(urutkanHari(j.days.map((d) => NAMA_HARI[d])))}, ${j.jam}`,
      )
      .join(" · ") || "Jadwal angkut belum diumumkan",
  memberCount: c.memberCount,
  distanceM: c.jarakM,
  pengurus: c.pengurus ?? "Belum ada pengurus",
  isMember: c.isMember,
  isManager: c.isManager,
  membership: c.statusKeanggotaan,
  latestPost: c.pengumumanTerbaru
    ? {
        author: c.pengumumanTerbaru.author,
        content: c.pengumumanTerbaru.content,
        agoDays: umurHari(c.pengumumanTerbaru.dibuatPada),
      }
    : undefined,
});

/** Channel yang diikuti dulu, lalu yang terdekat — urutan dari API. */
export const daftarChannel = async () =>
  (await ambil<BarisChannel[]>("/api/channel"))?.map(keChannel) ?? [];

export async function satuChannel(id: string) {
  const c = await ambil<BarisChannel>(`/api/channel/${id}`);
  return (
    c && {
      ...keChannel(c),
      jumlahPengumuman: c.jumlahPengumuman ?? 0,
      menunggu: c.menungguPersetujuan ?? 0,
    }
  );
}

/** Bacaan khusus anggota/pengurus: 403 (bukan haknya) jadi daftar kosong. */
const bacaanAnggota = async <T>(path: string): Promise<T[]> =>
  (await ambil<T[]>(path)) ?? [];

const keTulisan = (t: BarisTulisan) => ({
  id: t.id,
  author: t.author,
  authorRole: t.authorRole ?? undefined,
  content: t.content,
  agoDays: umurHari(t.dibuatPada),
});

export const pengumuman = async (channelId: string): Promise<ChannelPost[]> =>
  (
    await bacaanAnggota<BarisTulisan & { title: string }>(
      `/api/channel/${channelId}/pengumuman`,
    )
  ).map((p) => ({
    ...keTulisan(p),
    channelId,
    authorRole: p.authorRole ?? "Pengurus",
    title: p.title,
  }));

export const diskusi = async (channelId: string): Promise<ChannelThread[]> =>
  (
    await bacaanAnggota<BarisTulisan & { replies: BarisTulisan[] }>(
      `/api/channel/${channelId}/diskusi`,
    )
  ).map((u) => ({
    ...keTulisan(u),
    channelId,
    replies: u.replies.map(keTulisan),
  }));

export const anggota = async (channelId: string): Promise<ChannelMember[]> =>
  (
    await bacaanAnggota<{
      id: string;
      name: string;
      status: MemberStatus;
      isPengurus: boolean;
      houseLabel: string | null;
      dibuatPada: string;
    }>(`/api/channel/${channelId}/anggota`)
  ).map((a) => ({
    id: a.id,
    channelId,
    name: a.name,
    houseLabel: a.houseLabel ?? "Alamat belum diisi",
    status: a.status,
    agoDays: umurHari(a.dibuatPada),
    isPengurus: a.isPengurus,
  }));

export const daftarPaket = async () =>
  (await ambil<Plan[]>("/api/langganan/paket")) ?? [];

/** Riwayat tagihan (lunas & gagal), terbaru di atas. */
export const daftarTagihan = async () =>
  (await ambil<Invoice[]>("/api/langganan/tagihan")) ?? [];

export const satuTagihan = (id: string) =>
  ambil<Invoice>(`/api/langganan/tagihan/${id}`);

/** Penjemputan selesai yang bisa/sudah dinilai. */
type PickupDinilai = {
  pickupId: string;
  code: string;
  pickupDate: string;
  officerName: string | null;
};
export type UlasanTerkirim = Ulasan & PickupDinilai;

export async function umpanBalik() {
  const d = await ambil<{
    menunggu: PickupDinilai[];
    terkirim: (PickupDinilai & {
      rating: Ulasan["nilai"];
      tags: string[];
      comment: string | null;
      createdAt: string;
    })[];
  }>("/api/umpan-balik");
  return {
    menunggu: d?.menunggu ?? [],
    terkirim: (d?.terkirim ?? []).map((u): UlasanTerkirim => ({
      pickupId: u.pickupId,
      code: u.code,
      pickupDate: u.pickupDate,
      officerName: u.officerName,
      nilai: u.rating,
      tanda: u.tags,
      catatan: u.comment ?? "",
      dikirim: u.createdAt.slice(0, 10),
    })),
  };
}

/** Penilaian untuk satu penjemputan, kalau sudah ada. */
export const ulasanUntuk = async (pickupId: string) =>
  (await umpanBalik()).terkirim.find((u) => u.pickupId === pickupId) ?? null;
