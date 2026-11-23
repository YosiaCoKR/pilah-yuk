/**
 * Akun warga lewat Supabase Auth (GoTrue REST — cukup `fetch`, tanpa SDK).
 *
 * Disuntik ke app seperti `Gateway` pembayaran: produksi memakai
 * `buatSupabaseAuth`, pemeriksaan memakai tiruan yang menulis ke `auth.users`
 * PGlite sehingga trigger profil (migrasi 0012) ikut teruji.
 */

export type Peran = "warga" | "pengurus";

export type Sesi = {
  accessToken: string;
  refreshToken: string;
  /** Detik sampai accessToken kedaluwarsa. */
  expiresIn: number;
};

export type PermintaanDaftar = {
  /** Sudah dinormalkan ke bentuk 08xx. */
  hp: string;
  sandi: string;
  nama: string;
  peran: Peran;
};

type Masuk = { penggunaId: string; sesi: Sesi };

/** Semua metode melempar `GalatAkun` untuk penolakan yang boleh dibaca warga. */
export type PenyediaAkun = {
  /** Buat akun yang belum aktif dan kirim kode SMS. Mengulang = kirim ulang. */
  daftar: (p: PermintaanDaftar) => Promise<void>;
  /** Tukar kode SMS pendaftaran dengan sesi; profil lahir di titik ini. */
  verifikasi: (hp: string, kode: string) => Promise<Masuk>;
  /** `hp` sudah dinormalkan ke 08xx. */
  masuk: (hp: string, sandi: string) => Promise<Masuk>;
  /** Cabut sesi pemilik token (refresh token tidak bisa dipakai lagi). */
  keluar: (accessToken: string) => Promise<void>;
};

/** Penolakan yang pesannya boleh dibaca warga apa adanya. */
export class GalatAkun extends Error {
  constructor(
    readonly pesan: string,
    readonly status: 401 | 409 | 422 | 429 | 502,
  ) {
    super(pesan);
  }
}

/**
 * Sama dengan `normalkanHp` di frontend (src/lib/akun.ts) — paket terpisah,
 * jadi disalin. Kalau aturannya berubah, ubah keduanya.
 */
export function normalkanHp(hp: string): string {
  const angka = hp.replace(/[^\d+]/g, "");
  if (angka.startsWith("+62")) return `0${angka.slice(3)}`;
  if (angka.startsWith("62")) return `0${angka.slice(2)}`;
  return angka;
}

export const POLA_HP = /^08\d{8,12}$/;

/** 08xx → 628xx, bentuk E.164 tanpa "+" yang disimpan Supabase. */
export const keE164 = (hp: string) => `62${hp.slice(1)}`;

/** Satu pesan untuk nomor ATAU sandi salah — sama dengan GALAT_MASUK web. */
export const GALAT_MASUK =
  "Nomor HP atau kata sandinya tidak cocok. Periksa lagi, atau atur ulang sandi lewat tautan di bawah.";

export const GALAT_KODE =
  "Kodenya salah atau sudah kedaluwarsa. Periksa SMS terbaru, atau minta kode baru.";

export const GALAT_HP_TERDAFTAR =
  "Nomor ini sudah terdaftar. Masuk saja pakai nomor yang sama.";

type JawabanGoTrue = {
  id?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string };
  error_code?: string;
  msg?: string;
};

export function buatSupabaseAuth(
  url: string,
  serviceKey: string,
): PenyediaAkun {
  const kepala = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };

  /** `token` = token warga (logout); tanpa itu, memakai service key. */
  async function kirim(jalur: string, badan: unknown, token?: string) {
    try {
      const res = await fetch(`${url}/auth/v1${jalur}`, {
        method: "POST",
        headers: token
          ? { ...kepala, authorization: `Bearer ${token}` }
          : kepala,
        body: JSON.stringify(badan),
        signal: AbortSignal.timeout(10_000),
      });
      return {
        ok: res.ok,
        kode: res.status,
        j: (await res.json().catch(() => ({}))) as JawabanGoTrue,
      };
    } catch {
      /* Jaringan/timeout. Nama host dan jejak internal tidak diteruskan. */
      throw new GalatAkun(
        "Layanan akun sedang tidak bisa dihubungi. Coba lagi sebentar lagi.",
        502,
      );
    }
  }

  /** Tukar nomor + sandi dengan sesi; `null` = ditolak GoTrue. */
  async function ambilSesi(hp: string, sandi: string): Promise<Masuk | null> {
    const { ok, j } = await kirim("/token?grant_type=password", {
      phone: keE164(hp),
      password: sandi,
    });
    if (!ok || !j.access_token || !j.refresh_token || !j.user?.id) return null;
    return {
      penggunaId: j.user.id,
      sesi: {
        accessToken: j.access_token,
        refreshToken: j.refresh_token,
        expiresIn: j.expires_in ?? 3600,
      },
    };
  }

  return {
    /*
      `/signup` biasa (bukan Admin API): dengan "Confirm phone" aktif di
      Supabase, akun dibuat belum aktif dan kode SMS dikirim. Profil baru
      dibuat saat kodenya diverifikasi (trigger migrasi 0013), jadi orang yang
      memakai nomor orang lain tidak pernah sampai punya profil.

      Mendaftar ulang nomor yang belum diverifikasi = kirim ulang kode.
      Pastikan di proyek Supabase: Auth → Providers → Phone aktif, provider
      SMS terpasang, dan "Confirm phone" menyala — tanpa itu Supabase
      langsung mengaktifkan akun tanpa kode.
    */
    async daftar({ hp, sandi, nama, peran }) {
      const { ok, j } = await kirim("/signup", {
        phone: keE164(hp),
        password: sandi,
        data: { full_name: nama, role: peran },
        channel: "sms",
      });
      if (ok) return;
      if (
        j.error_code === "phone_exists" ||
        j.error_code === "user_already_exists"
      )
        throw new GalatAkun(GALAT_HP_TERDAFTAR, 409);
      if (j.error_code === "weak_password")
        throw new GalatAkun(
          "Kata sandinya terlalu mudah ditebak. Coba gabungkan huruf dan angka.",
          422,
        );
      if (j.error_code === "over_sms_send_rate_limit")
        throw new GalatAkun(
          "Kode baru saja dikirim. Tunggu satu menit sebelum minta lagi.",
          429,
        );
      console.error("Supabase Auth menolak pendaftaran:", j);
      throw new GalatAkun(
        "Akun belum bisa dibuat. Coba lagi sebentar lagi.",
        502,
      );
    },

    async verifikasi(hp, kode) {
      const { ok, j } = await kirim("/verify", {
        type: "sms",
        phone: keE164(hp),
        token: kode,
      });
      if (ok && j.access_token && j.refresh_token && j.user?.id)
        return {
          penggunaId: j.user.id,
          sesi: {
            accessToken: j.access_token,
            refreshToken: j.refresh_token,
            expiresIn: j.expires_in ?? 3600,
          },
        };
      /* GoTrue menjawab kode salah dan kode kedaluwarsa dengan galat yang
         sama (otp_expired); warga cukup tahu harus minta kode baru. */
      if (j.error_code !== "otp_expired")
        console.error("Supabase Auth menolak verifikasi:", j);
      throw new GalatAkun(GALAT_KODE, 422);
    },

    /*
      ponytail: semua permintaan masuk keluar dari IP server ini, jadi batas
      percobaan per-IP milik Supabase Auth tidak membedakan warga. Tambahkan
      pembatas percobaan per nomor HP di route kalau ada tanda tebak-sandi.
    */
    async masuk(hp, sandi) {
      const sesi = await ambilSesi(hp, sandi);
      if (!sesi) throw new GalatAkun(GALAT_MASUK, 401);
      return sesi;
    },

    async keluar(accessToken) {
      /* 401/403 = token sudah tidak berlaku: sesinya memang sudah mati,
         jadi keluarnya dianggap berhasil. */
      const { ok, kode } = await kirim("/logout?scope=local", {}, accessToken);
      if (!ok && kode !== 401 && kode !== 403)
        throw new GalatAkun("Belum bisa keluar. Coba lagi sebentar lagi.", 502);
    },
  };
}
