/**
 * Aturan pendaftaran akun.
 *
 * Dipisah dari komponen form supaya bisa diuji tanpa merender apa pun, dan
 * supaya halaman masuk nanti memakai aturan nomor HP yang persis sama.
 */

/** Sama dengan enum `peran_pengguna` di server. */
export type Peran = "warga" | "pengurus";

export type IsiDaftar = {
  nama: string;
  hp: string;
  sandi: string;
  peran: Peran;
};
export type GalatDaftar = Partial<Record<keyof IsiDaftar, string>>;

/**
 * Satukan semua cara warga menulis nomornya — +62, 62, spasi, tanda hubung —
 * menjadi satu bentuk 08xx. Tanpa ini "+62 812" dan "0812" terbaca sebagai
 * dua akun berbeda.
 */
export function normalkanHp(hp: string): string {
  const angka = hp.replace(/[^\d+]/g, "");
  if (angka.startsWith("+62")) return `0${angka.slice(3)}`;
  if (angka.startsWith("62")) return `0${angka.slice(2)}`;
  return angka;
}

const POLA_HP = /^08\d{8,12}$/;

export function periksaPendaftaran(
  isi: IsiDaftar,
  /** Nomor yang sudah dipakai — dari data tiruan, nanti dari server. */
  terdaftar: readonly string[] = [],
): GalatDaftar {
  const g: GalatDaftar = {};

  const nama = isi.nama.trim();
  if (!nama) {
    g.nama = "Tulis namamu dulu supaya petugas tahu memanggil siapa.";
  } else if (nama.length < 3) {
    g.nama = "Namanya terlalu singkat — minimal 3 huruf.";
  }

  const hp = normalkanHp(isi.hp);
  if (!hp) {
    g.hp = "Nomor HP dipakai untuk pengingat jemput, jadi wajib diisi.";
  } else if (!POLA_HP.test(hp)) {
    g.hp = "Pakai nomor HP Indonesia, mis. 0812 3456 7890.";
  } else if (terdaftar.includes(hp)) {
    g.hp = "Nomor ini sudah terdaftar. Masuk saja pakai nomor yang sama.";
  }

  if (!isi.sandi) {
    g.sandi = "Kata sandi mengunci alamat rumahmu, jadi wajib diisi.";
  } else if (isi.sandi.length < 8) {
    g.sandi = "Minimal 8 karakter biar tidak mudah ditebak.";
  }

  return g;
}

export type IsiMasuk = { hp: string; sandi: string };
export type GalatMasuk = Partial<Record<keyof IsiMasuk, string>>;

/**
 * Aturan halaman masuk. Memakai `normalkanHp` yang sama dengan pendaftaran —
 * nomor yang baru didaftarkan sebagai "+62 812…" harus bisa dipakai masuk
 * meski ditulis "0812…".
 *
 * ponytail: pencocokan ke daftar nomor ini cuma untuk data tiruan. API masuk
 * sungguhan mengembalikan satu pesan gabungan ("nomor atau sandi salah")
 * supaya tidak membocorkan nomor mana yang sudah terdaftar.
 */
export function periksaMasuk(
  isi: IsiMasuk,
  /** Nomor yang punya akun — dari data tiruan, nanti dijawab server. */
  terdaftar: readonly string[] = [],
): GalatMasuk {
  const g: GalatMasuk = {};

  const hp = normalkanHp(isi.hp);
  if (!hp) {
    g.hp = "Masuk pakai nomor HP yang dipakai saat mendaftar.";
  } else if (!POLA_HP.test(hp)) {
    g.hp = "Pakai nomor HP Indonesia, mis. 0812 3456 7890.";
  } else if (terdaftar.length && !terdaftar.includes(hp)) {
    g.hp = "Nomor ini belum punya akun. Daftar dulu, gratis.";
  }

  if (!isi.sandi) g.sandi = "Kata sandinya belum diisi.";
  else if (isi.sandi.length < 8) g.sandi = "Sandi minimal 8 karakter.";

  return g;
}

/**
 * Langkah 1 lupa sandi: cukup format nomornya. Sengaja TIDAK mencocokkan ke
 * daftar akun — jawaban "kode dikirim kalau nomor terdaftar" sama untuk semua
 * nomor, supaya halaman ini tidak bisa dipakai menebak nomor warga.
 */
export function periksaLupa(hp: string): string | undefined {
  const n = normalkanHp(hp);
  if (!n) return "Tulis nomor HP yang dipakai saat mendaftar.";
  if (!POLA_HP.test(n)) return "Pakai nomor HP Indonesia, mis. 0812 3456 7890.";
}

export type IsiAturUlang = { kode: string; sandi: string; ulang: string };
export type GalatAturUlang = Partial<Record<keyof IsiAturUlang, string>>;

/** Langkah 2: kode 6 angka dari SMS + sandi baru yang diketik dua kali. */
export function periksaAturUlang(isi: IsiAturUlang): GalatAturUlang {
  const g: GalatAturUlang = {};
  const kode = isi.kode.replace(/\s/g, "");
  if (!kode) g.kode = "Masukkan kode 6 angka dari SMS.";
  else if (!/^\d{6}$/.test(kode)) g.kode = "Kodenya 6 angka, tanpa huruf.";

  if (!isi.sandi) g.sandi = "Tulis kata sandi barumu.";
  else if (isi.sandi.length < 8)
    g.sandi = "Minimal 8 karakter biar tidak mudah ditebak.";

  if (isi.sandi && isi.ulang !== isi.sandi)
    g.ulang = "Belum sama dengan sandi di atas — ketik ulang pelan-pelan.";
  return g;
}
