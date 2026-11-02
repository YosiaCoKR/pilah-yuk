import { WASTE_CATEGORIES, addressById, slotById } from "./mock";
import { rupiah, tanggalPenuh } from "./tanggal";
import type {
  Invoice,
  Plan,
  RecurringSchedule,
  Subscription,
  WasteKey,
  Weekday,
} from "./types";

/**
 * Jadwal dalam bahasa yang warga pakai sendiri.
 *
 * Tabel jam dan daftar hari minta dibaca dua kali. Satu kalimat tidak. Semua
 * layar memakai perakit yang sama supaya kata-katanya persis sama di mana
 * pun jadwalnya muncul.
 */

const URUTAN_HARI: Weekday[] = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

/** "Selasa & Jumat", "Senin, Rabu & Jumat" — bukan daftar berkoma kaku. */
export function gabung(xs: string[]): string {
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`;
}

/** Hari selalu dibaca menurut urutan minggu, bukan urutan ditekan. */
export const urutkanHari = (hari: Weekday[]) =>
  URUTAN_HARI.filter((h) => hari.includes(h));

/**
 * Bagian hari dari jam mulai. Warga bilang "pagi", bukan "06.00–08.00" —
 * jamnya tetap ditampilkan di sebelahnya untuk yang butuh persisnya.
 */
export function bagianHari(slotId: string): string {
  const jam = Number(slotById(slotId)?.range.slice(0, 2) ?? 0);
  if (jam < 11) return "pagi";
  if (jam < 15) return "siang";
  if (jam < 17) return "sore";
  return "menjelang magrib";
}

export const namaJenis = (xs: WasteKey[]) =>
  xs.map((k) => WASTE_CATEGORIES.find((c) => c.key === k)!.name.toLowerCase());

/**
 * Kalimat utuh: "Setiap Selasa & Jumat pagi, petugas ambil organik & plastik
 * dari Rumah." Dipakai di kartu jadwal, form, dan detail.
 */
export function kalimatRutin(jadwal: RecurringSchedule): string {
  const hari = gabung(urutkanHari(jadwal.days));
  const alamat = addressById(jadwal.addressId)?.label ?? "alamatmu";

  if (jadwal.days.length === 0) return "Belum ada hari yang dipilih.";

  const jenis = jadwal.categories.length
    ? gabung(namaJenis(jadwal.categories))
    : "sampah";

  return `Setiap ${hari} ${bagianHari(jadwal.timeSlotId)}, petugas ambil ${jenis} dari ${alamat}.`;
}

/** Baris pendamping yang menyebut jamnya persis, untuk yang butuh pasti. */
export function jamPersis(jadwal: RecurringSchedule): string {
  return `Rentang jemput ${slotById(jadwal.timeSlotId)?.range}.`;
}

/** "hari ini" / "kemarin" / "9 hari lalu" — umur pengumuman dibaca, bukan dihitung. */
export const umurHari = (hari: number) =>
  hari === 0 ? "hari ini" : hari === 1 ? "kemarin" : `${hari} hari lalu`;

/**
 * Lama bergabung, dibulatkan seperti orang bicara: "12 hari", "6 bulan",
 * "3 tahun". Pengurus membaca ini untuk membedakan warga lama dari yang baru,
 * bukan untuk menghitung hari.
 */
export function lamaAnggota(hari: number) {
  if (hari < 30) return `${Math.max(hari, 1)} hari`;
  if (hari < 365) return `${Math.round(hari / 30)} bulan`;
  const tahun = Math.floor(hari / 365);
  return tahun < 2 ? "lebih dari setahun" : `${tahun} tahun`;
}

/** Rata-rata minggu per bulan — penyetara paket mingguan dan bulanan. */
const MINGGU_SEBULAN = 4.345;

/**
 * "8 jemput · sekitar 2× seminggu".
 *
 * Yang ditimbang warga saat memilih paket bukan kuota bulanan, tapi seberapa
 * sering truk mampir. Dihitung dari kuota, bukan ditulis tangan per paket —
 * paket baru dari backend ikut terbaca tanpa menambah kolom.
 */
export function iramaJemput(paket: Plan) {
  const mingguan = paket.billingCycle === "mingguan";
  const perMinggu = mingguan
    ? paket.pickupQuota
    : paket.pickupQuota / MINGGU_SEBULAN;
  const bulat = Math.max(1, Math.round(perMinggu));
  const irama = `${mingguan ? "" : "sekitar\u00a0"}${bulat}×\u00a0seminggu`;
  return `${paket.pickupQuota} jemput · ${irama}`;
}

/** Harga satu jemput — angka yang membuat paket bisa dibandingkan. */
export const hargaPerJemput = (paket: Plan) =>
  Math.round(paket.price / paket.pickupQuota);

/** "bulan" / "minggu", dibaca dari siklusnya saja supaya langganan yang sedang
    berjalan bisa memakainya juga. */
export const satuanSiklus = (siklus: Subscription["billingCycle"]) =>
  siklus === "mingguan" ? "minggu" : "bulan";

/** Label rata kiri dengan lebar tetap, supaya kuitansinya terbaca rapi di
    aplikasi catatan mana pun — termasuk yang hurufnya tidak monospace. */
const barisKuitansi = (label: string, nilai: string) =>
  `${label.padEnd(10)}: ${nilai}`;

/**
 * Kuitansi langganan sebagai teks biasa.
 *
 * Bentuknya sengaja sama dengan tanda terima pengangkutan: satu berkas yang
 * bisa dibuka di mana saja dan ditempel ke WhatsApp tanpa pembaca PDF.
 * Tagihan gagal pun punya kuitansi — justru itu yang dibawa warga saat
 * uangnya sudah terpotong tapi langganannya tidak jalan.
 */
export function teksKuitansi(tagihan: Invoice): string {
  return [
    "KUITANSI LANGGANAN",
    "Pilah Yuk",
    "",
    barisKuitansi("Kode", tagihan.code),
    barisKuitansi("Paket", tagihan.planName),
    barisKuitansi(
      "Masa",
      `${tanggalPenuh(tagihan.periodStart)} sampai ${tanggalPenuh(tagihan.periodEnd)}`,
    ),
    barisKuitansi("Jumlah", rupiah(tagihan.amount)),
    barisKuitansi("Cara bayar", tagihan.method),
    barisKuitansi("Tanggal", tanggalPenuh(tagihan.paidAt)),
    barisKuitansi("Status", tagihan.status === "lunas" ? "Lunas" : "Gagal"),
    /* null, bukan "" — baris kosong di atas memang pemisah yang disengaja,
       jadi hanya baris opsional yang boleh hilang. */
    tagihan.failureReason ? barisKuitansi("Sebab", tagihan.failureReason) : null,
    "",
    "Dokumen ini dibuat otomatis dari aplikasi Pilah Yuk.",
  ]
    .filter((b) => b !== null)
    .join("\n");
}
