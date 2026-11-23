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

/** Isian yang baru dipasang SETELAH nomornya terbukti milik pendaftar. */
export type IsianAkun = { sandi: string; nama: string; peran: Peran };

type Masuk = { penggunaId: string; sesi: Sesi };

/** Semua metode melempar `GalatAkun` untuk penolakan yang boleh dibaca warga. */
export type PenyediaAkun = {
  /**
   * Kirim kode SMS ke nomor (08xx). Sengaja TANPA sandi maupun nama: apa pun
   * yang dititipkan sebelum nomor terbukti bisa ditimpa orang lain yang
   * mendaftar nomor yang sama, dan sandinya ikut aktif saat korban
   * memasukkan kode.
   */
  kirimKode: (hp: string, buatAkun?: boolean) => Promise<void>;
  /** Kode cocok → akun aktif, lalu sandi + nama + peran dipasang. */
  verifikasi: (hp: string, kode: string, isian: IsianAkun) => Promise<Masuk>;
  /**
   * Lupa sandi: kode cocok → sandi baru dipasang dan SEMUA sesi dicabut,
   * supaya siapa pun yang memegang sandi lama ikut terlempar keluar.
   */
  aturUlangSandi: (hp: string, kode: string, sandi: string) => Promise<void>;
  /** `hp` sudah dinormalkan ke 08xx. */
  masuk: (hp: string, sandi: string) => Promise<Masuk>;
  /** Cabut sesi pemilik token (refresh token tidak bisa dipakai lagi). */
  keluar: (accessToken: string) => Promise<void>;
  /** Tukar refresh token dengan sesi baru (access token berumur ±1 jam). */
  segarkan: (refreshToken: string) => Promise<Masuk>;
  /** Id pemilik access token, atau `null` bila token palsu/kedaluwarsa/dicabut. */
  kenali: (accessToken: string) => Promise<string | null>;
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

export const GALAT_SESI_HABIS =
  "Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.";

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
  /** Token → pemilik, untuk `kenali`. Hanya di memori proses ini. */
  const kenal = new Map<string, { id: string; sampai: number }>();
  const kepala = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };

  /** `token` = token warga (logout); tanpa itu, memakai service key. */
  async function kirim(
    jalur: string,
    badan: unknown,
    token?: string,
    method = "POST",
  ) {
    try {
      const res = await fetch(`${url}/auth/v1${jalur}`, {
        method,
        headers: token
          ? { ...kepala, authorization: `Bearer ${token}` }
          : kepala,
        body: method === "GET" ? undefined : JSON.stringify(badan),
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

  /** Tukar kode SMS dengan sesi. Kode salah/kedaluwarsa → GALAT_KODE. */
  async function tukarKode(hp: string, kode: string): Promise<Masuk> {
    const v = await kirim("/verify", {
      type: "sms",
      phone: keE164(hp),
      token: kode,
    });
    const j = v.j;
    if (!v.ok || !j.access_token || !j.refresh_token || !j.user?.id) {
      /* GoTrue menjawab kode salah dan kode kedaluwarsa dengan galat yang
           sama (otp_expired); warga cukup tahu harus minta kode baru. */
      if (j.error_code !== "otp_expired")
        console.error("Supabase Auth menolak verifikasi:", j);
      throw new GalatAkun(GALAT_KODE, 422);
    }

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
    async kirimKode(hp, buatAkun = true) {
      /* `/otp` + create_user: akun tanpa sandi dibuat bila belum ada, kode
         dikirim. Lupa sandi memakai create_user false. Pastikan di Supabase:
         Auth → Providers → Phone aktif dan provider SMS terpasang. */
      const { ok, j } = await kirim("/otp", {
        phone: keE164(hp),
        create_user: buatAkun,
        channel: "sms",
      });
      if (ok) return;
      if (j.error_code === "over_sms_send_rate_limit")
        throw new GalatAkun(
          "Kode baru saja dikirim. Tunggu satu menit sebelum minta lagi.",
          429,
        );
      console.error("Supabase Auth menolak mengirim kode:", j);
      throw new GalatAkun(
        "Kode belum bisa dikirim. Coba lagi sebentar lagi.",
        502,
      );
    },

    async verifikasi(hp, kode, { sandi, nama, peran }) {
      const masuk = await tukarKode(hp, kode);

      /* Baru sekarang sandi dipasang — dengan token milik warga ini sendiri,
         jadi tidak ada jalan menitipkan sandi ke nomor orang lain. */
      const pasang = await kirim(
        "/user",
        { password: sandi, data: { full_name: nama, role: peran } },
        masuk.sesi.accessToken,
        "PUT",
      );
      if (!pasang.ok) {
        console.error("Supabase Auth menolak memasang sandi:", pasang.j);
        throw new GalatAkun(
          pasang.j.error_code === "weak_password"
            ? "Nomormu sudah terverifikasi, tapi sandinya terlalu mudah ditebak. Atur sandi baru lewat Lupa sandi."
            : "Nomormu sudah terverifikasi, tapi sandinya belum tersimpan. Atur sandi lewat Lupa sandi.",
          502,
        );
      }

      return masuk;
    },

    async aturUlangSandi(hp, kode, sandi) {
      const { sesi } = await tukarKode(hp, kode);
      const pasang = await kirim(
        "/user",
        { password: sandi },
        sesi.accessToken,
        "PUT",
      );
      if (!pasang.ok) {
        console.error("Supabase Auth menolak sandi baru:", pasang.j);
        throw new GalatAkun(
          pasang.j.error_code === "weak_password"
            ? "Sandinya terlalu mudah ditebak. Minta kode baru, lalu coba sandi lain."
            : "Sandi baru belum tersimpan. Minta kode baru lalu coba lagi.",
          502,
        );
      }
      /* scope=global: semua refresh token akun ini mati, di perangkat mana
         pun. Kalau gagal, sandinya tetap sudah berganti — catat saja. */
      const cabut = await kirim("/logout?scope=global", {}, sesi.accessToken);
      if (!cabut.ok) console.error("Gagal mencabut sesi lama:", cabut.j);
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
      kenal.delete(accessToken); // keluar langsung berlaku di instance ini
      const { ok, kode } = await kirim("/logout?scope=local", {}, accessToken);
      if (!ok && kode !== 401 && kode !== 403)
        throw new GalatAkun("Belum bisa keluar. Coba lagi sebentar lagi.", 502);
    },

    async segarkan(refreshToken) {
      const { ok, j } = await kirim("/token?grant_type=refresh_token", {
        refresh_token: refreshToken,
      });
      if (!ok || !j.access_token || !j.refresh_token || !j.user?.id)
        throw new GalatAkun(GALAT_SESI_HABIS, 401);
      return {
        penggunaId: j.user.id,
        sesi: {
          accessToken: j.access_token,
          refreshToken: j.refresh_token,
          expiresIn: j.expires_in ?? 3600,
        },
      };
    },

    /*
      Token ditanyakan ke Supabase (`GET /user`), bukan diverifikasi sendiri:
      berlaku untuk kunci tanda tangan apa pun (HS256 lama maupun ES256/RS256
      baru) dan sesi yang sudah dicabut ikut ditolak.

      ponytail: jawaban disimpan 30 detik per token supaya tidak tiap
      request memanggil Supabase — sesi yang dicabut di instance lain masih
      lolos paling lama 30 detik. Ganti ke verifikasi JWKS lokal kalau
      latensinya terasa.
    */
    async kenali(accessToken) {
      const sekarang = Date.now();
      const ingat = kenal.get(accessToken);
      if (ingat && ingat.sampai > sekarang) return ingat.id;

      const { ok, j } = await kirim("/user", undefined, accessToken, "GET");
      const id = ok ? j.id : undefined;
      if (!id) return null;
      if (kenal.size > 10_000) kenal.clear();
      kenal.set(accessToken, { id, sampai: sekarang + 30_000 });
      return id;
    },
  };
}
