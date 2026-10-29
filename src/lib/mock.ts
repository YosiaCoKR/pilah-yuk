import type {
  Address,
  Channel,
  ChannelMember,
  ChannelPost,
  ChannelThread,
  Pickup,
  RecurringSchedule,
  Subscription,
  TimeSlot,
  WasteCategory,
  WasteKey,
} from "./types";

/* Stub data standing in for the API until the backend layer lands. */

export const WASTE_CATEGORIES: WasteCategory[] = [
  {
    key: "organik",
    name: "Organik",
    description: "Sisa makanan, daun, kulit buah",
    handlingTip: "Tiriskan dulu biar tidak bocor dan bau di perjalanan.",
  },
  {
    key: "plastik",
    name: "Plastik",
    description: "Botol, kemasan, kresek",
    handlingTip: "Bilas sebentar lalu pipihkan supaya tidak makan tempat.",
  },
  {
    key: "kertas",
    name: "Kertas",
    description: "Kardus, koran, buku bekas",
    handlingTip: "Simpan kering — kertas basah tidak bisa didaur ulang.",
  },
  {
    key: "campuran",
    name: "Campuran",
    description: "Belum terpilah",
    handlingTip: "Boleh, tapi petugas butuh waktu lebih lama memilah.",
  },
];

/** Bin colour per category. Used anywhere a category needs identifying. */
export const WASTE_COLOR: Record<WasteKey, string> = {
  organik: "var(--color-organik)",
  plastik: "var(--color-plastik)",
  kertas: "var(--color-kertas)",
  campuran: "var(--color-campuran)",
};

export const ADDRESSES: Address[] = [
  {
    id: "addr-1",
    label: "Rumah",
    fullAddress: "Jl. Kenanga No. 12, RT 03 / RW 05, Kel. Sukamaju",
    landmark: "Sebelah warung Bu Tini, pagar hijau",
    rwChannelName: "RW 05 Sukamaju",
    isDefault: true,
  },
  {
    id: "addr-2",
    label: "Rumah Ibu",
    fullAddress: "Jl. Melati Dalam No. 4, RT 01 / RW 05, Kel. Sukamaju",
    landmark: "Depan musala Al-Ikhlas",
    rwChannelName: "RW 05 Sukamaju",
    isDefault: false,
  },
  {
    id: "addr-3",
    label: "Warung",
    fullAddress: "Kios 7 Pasar Sukamaju, RT 06 / RW 05",
    landmark: "Blok daging, pintu timur",
    rwChannelName: "RW 05 Sukamaju",
    isDefault: false,
  },
];

export const TIME_SLOTS: TimeSlot[] = [
  { id: "slot-pagi", range: "06.00–08.00", note: "Paling sering dipilih" },
  { id: "slot-siang", range: "09.00–11.00", note: "Petugas lewat setelah pasar" },
  { id: "slot-sore", range: "15.00–17.00", note: "Kuota penuh", full: true },
  { id: "slot-petang", range: "17.00–19.00", note: "Sebelum magrib" },
];

export const PICKUPS: Pickup[] = [
  {
    id: "pk-1",
    code: "PY-4821",
    addressId: "addr-1",
    pickupDate: "2026-11-03",
    timeSlotId: "slot-pagi",
    categories: ["organik", "plastik"],
    status: "menunggu",
    recurring: true,
  },
  {
    id: "pk-5",
    code: "PY-4824",
    addressId: "addr-1",
    pickupDate: "2026-11-06",
    timeSlotId: "slot-pagi",
    categories: ["organik", "plastik"],
    status: "menunggu",
    recurring: true,
  },
  {
    id: "pk-6",
    code: "PY-4830",
    addressId: "addr-1",
    pickupDate: "2026-11-10",
    timeSlotId: "slot-pagi",
    categories: ["organik", "plastik"],
    status: "menunggu",
    recurring: true,
  },
  {
    id: "pk-7",
    code: "PY-4836",
    addressId: "addr-3",
    pickupDate: "2026-11-13",
    timeSlotId: "slot-siang",
    categories: ["campuran"],
    status: "menunggu",
    notes: "Dua karung dari kios",
  },
  {
    id: "pk-8",
    code: "PY-4841",
    addressId: "addr-1",
    pickupDate: "2026-12-02",
    timeSlotId: "slot-pagi",
    categories: ["organik", "kertas"],
    status: "menunggu",
    recurring: true,
  },
  {
    id: "pk-2",
    code: "PY-4790",
    addressId: "addr-1",
    pickupDate: "2026-10-27",
    timeSlotId: "slot-pagi",
    categories: ["organik", "kertas"],
    status: "selesai",
    totalWeightKg: 6.4,
    officerName: "Pak Dedi",
    recurring: true,
  },
  {
    id: "pk-3",
    code: "PY-4755",
    addressId: "addr-3",
    pickupDate: "2026-10-24",
    timeSlotId: "slot-siang",
    categories: ["campuran"],
    status: "selesai",
    totalWeightKg: 11.2,
    officerName: "Pak Dedi",
    notes: "Dua karung dari kios",
  },
  {
    id: "pk-4",
    code: "PY-4712",
    addressId: "addr-1",
    pickupDate: "2026-10-20",
    timeSlotId: "slot-pagi",
    categories: ["organik", "plastik", "kertas"],
    status: "selesai",
    totalWeightKg: 8.1,
    officerName: "Bu Sri",
  },
];

/* Jadwal rutin warga. Ubah `isPaused` untuk melihat keadaan dijeda. */
export const RECURRING: RecurringSchedule = {
  id: "rec-1",
  addressId: "addr-1",
  days: ["Selasa", "Jumat"],
  timeSlotId: "slot-pagi",
  startDate: "2026-09-01",
  endDate: null,
  isPaused: false,
  pausedUntil: null,
  reminderEnabled: true,
  categories: ["organik", "plastik"],
};

export function addressById(id: string | null | undefined) {
  return ADDRESSES.find((a) => a.id === id);
}

export function slotById(id: string | null | undefined) {
  return TIME_SLOTS.find((s) => s.id === id);
}

export function categoryByKey(key: WasteKey) {
  return WASTE_CATEGORIES.find((c) => c.key === key)!;
}


/* Flip `status` here to see the other states of the subscription notice. */
export const SUBSCRIPTION: Subscription = {
  id: "sub-1",
  planName: "Bulanan Rumah Tangga",
  billingCycle: "bulanan",
  status: "aktif",
  endDate: "2026-11-12",
  pickupQuota: 8,
  pickupUsed: 6,
  price: 45_000,
  autoRenew: true,
};

/** Riwayat lebih panjang supaya halaman riwayat punya isi lintas bulan. */
export const RIWAYAT_TAMBAHAN: Pickup[] = [
  {
    id: "pk-9",
    code: "PY-4701",
    addressId: "addr-1",
    pickupDate: "2026-10-17",
    timeSlotId: "slot-pagi",
    categories: ["organik", "plastik"],
    status: "selesai",
    totalWeightKg: 7.2,
    officerName: "Pak Dedi",
  },
  {
    id: "pk-10",
    code: "PY-4688",
    addressId: "addr-1",
    pickupDate: "2026-10-13",
    timeSlotId: "slot-pagi",
    categories: ["organik"],
    status: "selesai",
    totalWeightKg: 4.8,
    officerName: "Bu Sri",
  },
  {
    id: "pk-11",
    code: "PY-4650",
    addressId: "addr-3",
    pickupDate: "2026-09-29",
    timeSlotId: "slot-siang",
    categories: ["campuran"],
    status: "selesai",
    totalWeightKg: 13.5,
    officerName: "Pak Dedi",
  },
  {
    id: "pk-12",
    code: "PY-4631",
    addressId: "addr-1",
    pickupDate: "2026-09-22",
    timeSlotId: "slot-pagi",
    categories: ["kertas"],
    status: "batal",
    notes: "Keluar kota mendadak",
  },
];

/** Semua pesanan: mendatang + riwayat. */
export const SEMUA_PICKUP: Pickup[] = [...PICKUPS, ...RIWAYAT_TAMBAHAN];


export const PENGUMUMAN: ChannelPost[] = [
  {
    id: "pg-1",
    channelId: "ch-1",
    author: "Pak Hendra",
    authorRole: "Ketua RW 05",
    title: "Truk Jumat datang lebih pagi",
    content:
      "Jumat 7 Nov truk datang lebih pagi, mohon karung sudah di depan pagar sebelum 06.00.",
    agoDays: 2,
  },
  {
    id: "pg-2",
    channelId: "ch-1",
    author: "Pak Hendra",
    authorRole: "Ketua RW 05",
    title: "Kantong organik dibagikan di balai RW",
    content:
      "Kantong organik gratis bisa diambil di balai RW tiap Sabtu pagi, satu rumah dua lembar.",
    agoDays: 9,
  },
  {
    id: "pg-3",
    channelId: "ch-1",
    author: "Bu Sari",
    authorRole: "Sekretaris RW 05",
    title: "Sampah pecah belah dipisah",
    content:
      "Mohon pecahan kaca dibungkus kardus dulu sebelum masuk karung. Sudah ada petugas yang tangannya luka minggu lalu.",
    agoDays: 16,
  },
  {
    id: "pg-4",
    channelId: "ch-2",
    author: "Bu Ratna",
    authorRole: "Ketua RW 06",
    title: "Kerja bakti pilah sampah",
    content: "Kerja bakti pilah sampah Minggu pagi di balai RW.",
    agoDays: 5,
  },
  {
    id: "pg-5",
    channelId: "ch-2",
    author: "Bu Ratna",
    authorRole: "Ketua RW 06",
    title: "Iuran angkut bulan ini",
    content:
      "Iuran angkut bulan ini ditutup tanggal 25. Bisa lewat aplikasi atau titip ke petugas.",
    agoDays: 12,
  },
  {
    id: "pg-6",
    channelId: "ch-3",
    author: "Pak Yusuf",
    authorRole: "Ketua RW 02",
    title: "Jam angkut digeser ke sore",
    content:
      "Mulai bulan depan jam angkut digeser ke 15.00–17.00 karena petugas pagi dipindah ke wilayah lain.",
    agoDays: 3,
  },
];

/** Pengumuman satu channel, terbaru di atas. */
export const pengumumanByChannel = (channelId: string) =>
  PENGUMUMAN.filter((p) => p.channelId === channelId).sort(
    (a, b) => a.agoDays - b.agoDays,
  );

const CHANNELS_DASAR: Omit<Channel, "latestPost">[] = [
  {
    id: "ch-1",
    name: "RW 05 Sukamaju",
    rtNumber: "03",
    rwNumber: "05",
    kelurahan: "Sukamaju",
    areaCode: "3573",
    scheduleInfo: "Selasa & Jumat, 06.00–08.00",
    memberCount: 142,
    distanceM: 120,
    pengurus: "Pak Hendra",
    isMember: true,
    isManager: true,
  },
  {
    id: "ch-2",
    name: "RW 06 Sukamaju",
    rtNumber: "01",
    rwNumber: "06",
    kelurahan: "Sukamaju",
    areaCode: "3573",
    scheduleInfo: "Rabu & Sabtu, 06.00–08.00",
    memberCount: 98,
    distanceM: 640,
    pengurus: "Bu Ratna",
    isMember: false,
    isManager: false,
  },
  {
    id: "ch-3",
    name: "RW 02 Mekarsari",
    rtNumber: "04",
    rwNumber: "02",
    kelurahan: "Mekarsari",
    areaCode: "3573",
    scheduleInfo: "Senin & Kamis, 15.00–17.00",
    memberCount: 76,
    distanceM: 1850,
    pengurus: "Pak Yusuf",
    isMember: false,
    isManager: false,
  },
  {
    id: "ch-4",
    name: "RW 09 Mekarsari",
    rtNumber: "02",
    rwNumber: "09",
    kelurahan: "Mekarsari",
    areaCode: "3573",
    scheduleInfo: "Selasa & Jumat, 17.00–19.00",
    memberCount: 54,
    distanceM: 3200,
    pengurus: "Bu Lastri",
    isMember: false,
    isManager: false,
  },
];

/* `latestPost` selalu pengumuman terbaru channel itu — satu sumber data, jadi
   pratinjau di daftar tidak bisa berbeda dari isi halaman pengumuman. */
export const CHANNELS: Channel[] = CHANNELS_DASAR.map((c) => {
  const terbaru = pengumumanByChannel(c.id)[0];
  if (!terbaru) return c;
  const { author, content, agoDays } = terbaru;
  return { ...c, latestPost: { author, content, agoDays } };
});

/* Papan diskusi warga. Utas pendek dan konkret — pertanyaan yang benar-benar
   muncul di grup RT: jam truk, sampah yang tidak terangkut, cara memilah. */
export const DISKUSI: ChannelThread[] = [
  {
    id: "ut-1",
    channelId: "ch-1",
    author: "Bu Wati",
    content:
      "Karung saya kemarin tidak terangkut padahal sudah di depan pagar sejak jam 6. Ada yang sama?",
    agoDays: 1,
    replies: [
      {
        id: "bl-1",
        author: "Mas Dedi",
        content: "Sama, rumah nomor 14 juga dilewat. Mungkin truknya penuh.",
        agoDays: 1,
      },
      {
        id: "bl-2",
        author: "Pak Hendra",
        authorRole: "Ketua RW 05",
        content:
          "Saya cek ke petugas. Yang terlewat hari Jumat akan diambil Sabtu pagi, tidak perlu pesan jemput lagi.",
        agoDays: 0,
      },
    ],
  },
  {
    id: "ut-2",
    channelId: "ch-1",
    author: "Mbak Rina",
    content:
      "Minyak jelantah masuk organik atau campuran ya? Takut bocor di karung.",
    agoDays: 4,
    replies: [
      {
        id: "bl-3",
        author: "Bu Sari",
        authorRole: "Sekretaris RW 05",
        content:
          "Jangan dicampur. Masukkan botol tertutup, nanti ditampung terpisah di balai RW.",
        agoDays: 4,
      },
    ],
  },
  {
    id: "ut-3",
    channelId: "ch-1",
    author: "Pak Agus",
    content:
      "Usul: kalau hari jemput kena libur nasional, tolong diumumkan sehari sebelumnya.",
    agoDays: 11,
    replies: [],
  },
  {
    id: "ut-4",
    channelId: "ch-2",
    author: "Mas Bayu",
    content: "Kerja bakti Minggu mulai jam berapa? Bawa karung sendiri?",
    agoDays: 3,
    replies: [
      {
        id: "bl-4",
        author: "Bu Ratna",
        authorRole: "Ketua RW 06",
        content: "Jam 7 di balai RW. Karung disediakan, bawa sarung tangan saja.",
        agoDays: 2,
      },
    ],
  },
];

/** Utas satu channel, terbaru di atas. */
export const diskusiByChannel = (channelId: string) =>
  DISKUSI.filter((d) => d.channelId === channelId).sort(
    (a, b) => a.agoDays - b.agoDays,
  );

/* Anggota channel. `menunggu` di atas saat ditampilkan — itu satu-satunya
   bagian daftar ini yang menuntut keputusan pengurus. */
export const ANGGOTA: ChannelMember[] = [
  {
    id: "ag-1",
    channelId: "ch-1",
    name: "Pak Hendra",
    houseLabel: "Blok C no. 2",
    status: "aktif",
    agoDays: 420,
    isPengurus: true,
  },
  {
    id: "ag-2",
    channelId: "ch-1",
    name: "Bu Sari",
    houseLabel: "Blok C no. 7",
    status: "aktif",
    agoDays: 380,
    isPengurus: true,
  },
  {
    id: "ag-3",
    channelId: "ch-1",
    name: "Bu Wati",
    houseLabel: "Blok A no. 11",
    status: "aktif",
    agoDays: 190,
  },
  {
    id: "ag-4",
    channelId: "ch-1",
    name: "Mas Dedi",
    houseLabel: "Blok A no. 14",
    status: "aktif",
    agoDays: 96,
  },
  {
    id: "ag-5",
    channelId: "ch-1",
    name: "Mbak Rina",
    houseLabel: "Blok B no. 5",
    status: "aktif",
    agoDays: 54,
  },
  {
    id: "ag-6",
    channelId: "ch-1",
    name: "Pak Agus",
    houseLabel: "Blok B no. 9",
    status: "aktif",
    agoDays: 21,
  },
  {
    id: "ag-7",
    channelId: "ch-1",
    name: "Bu Tini",
    houseLabel: "Blok D no. 3",
    status: "menunggu",
    agoDays: 2,
  },
  {
    id: "ag-8",
    channelId: "ch-1",
    name: "Mas Fajar",
    houseLabel: "Blok D no. 8 (kontrakan depan warung)",
    status: "menunggu",
    agoDays: 0,
  },
  {
    id: "ag-9",
    channelId: "ch-2",
    name: "Bu Ratna",
    houseLabel: "Blok E no. 1",
    status: "aktif",
    agoDays: 300,
    isPengurus: true,
  },
];

/** Anggota satu channel: yang menunggu persetujuan lebih dulu. */
export const anggotaByChannel = (channelId: string) =>
  ANGGOTA.filter((a) => a.channelId === channelId).sort((a, b) => {
    if (a.status !== b.status) return a.status === "menunggu" ? -1 : 1;
    return a.agoDays - b.agoDays;
  });

export const channelById = (id: string) => CHANNELS.find((c) => c.id === id);

/** "120 m" / "1,9 km" — warga membaca jarak, bukan koordinat. */
export function jarakTerbaca(meter: number) {
  if (meter < 1000) return `${meter} m`;
  return `${(meter / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}
