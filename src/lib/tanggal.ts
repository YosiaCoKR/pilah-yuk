/* Indonesian date helpers. Intl handles the locale; we only pick the shapes
   the design needs: a short weekday for the ticket, a long one for details. */

const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const BULAN_PENDEK = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Parse an ISO date (yyyy-mm-dd) as a local date, not UTC midnight. */
export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export const hariPendek = (iso: string) => HARI_PENDEK[parseISO(iso).getDay()];
export const hariPanjang = (iso: string) => HARI[parseISO(iso).getDay()];

/** "04 Nov" */
export function tanggalPendek(iso: string) {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${BULAN_PENDEK[d.getMonth()]}`;
}

/** "Selasa, 4 November 2026" */
export function tanggalPanjang(iso: string) {
  const d = parseISO(iso);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Plain-language distance in days: warga read "besok" far faster than a date.
 * Returns null when it is far enough out that the date itself is clearer.
 */
export function jarakHari(iso: string, from = new Date()): string | null {
  const a = parseISO(iso).setHours(0, 0, 0, 0);
  const b = new Date(from).setHours(0, 0, 0, 0);
  const selisih = Math.round((a - b) / 86_400_000);
  if (selisih === 0) return "hari ini";
  if (selisih === 1) return "besok";
  if (selisih === 2) return "besok lusa";
  if (selisih > 2 && selisih < 7) return `${selisih} hari lagi`;
  if (selisih === -1) return "kemarin";
  if (selisih < -1 && selisih > -7) return `${Math.abs(selisih)} hari lalu`;
  return null;
}

/** The next `count` days starting today, for the date picker. */
export function hariMendatang(count: number, from = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return toISO(d);
  });
}

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * `hariMendatang` with a stable reference per (count, today). Required by
 * useSyncExternalStore, which re-renders forever if the snapshot identity
 * changes on every call.
 */
let simpanRail: { kunci: string; nilai: string[] } | null = null;
export function railHari(count: number): string[] {
  const kunci = `${count}@${toISO(new Date())}`;
  if (simpanRail?.kunci !== kunci) {
    simpanRail = { kunci, nilai: hariMendatang(count) };
  }
  return simpanRail.nilai;
}

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "November 2026" — pemisah bulan di daftar jadwal. */
export function bulanTahun(iso: string) {
  const d = parseISO(iso);
  return `${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export const bulanPendekDari = (iso: string) =>
  BULAN[parseISO(iso).getMonth()].slice(0, 3);

/** Tanggal hari ini sebagai ISO yyyy-mm-dd. String, jadi referensinya stabil. */
export const hariIniISO = () => toISO(new Date());

/** `hari` hari setelah `mulaiISO`. Murni — tidak membaca jam sistem. */
export function geserHari(mulaiISO: string, hari: number): string {
  const d = parseISO(mulaiISO);
  d.setDate(d.getDate() + hari);
  return toISO(d);
}
