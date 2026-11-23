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

export type PenyediaAkun = {
  /** Buat akun lalu langsung masuk. Melempar `GalatAkun`. */
  daftar: (p: PermintaanDaftar) => Promise<{ penggunaId: string; sesi: Sesi }>;
};

/** Penolakan yang pesannya boleh dibaca warga apa adanya. */
export class GalatAkun extends Error {
  constructor(
    readonly pesan: string,
    readonly status: 409 | 422 | 502,
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

  async function kirim(jalur: string, badan: unknown) {
    try {
      const res = await fetch(`${url}/auth/v1${jalur}`, {
        method: "POST",
        headers: kepala,
        body: JSON.stringify(badan),
        signal: AbortSignal.timeout(10_000),
      });
      return {
        ok: res.ok,
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

  return {
    async daftar({ hp, sandi, nama, peran }) {
      const phone = keE164(hp);
      /*
        Admin API + phone_confirm: tidak ada SMS OTP saat daftar, supaya
        pendaftaran selesai dalam semenit (PRD).

        ponytail: nomornya belum dibuktikan milik pendaftar. Pemilik asli
        merebutnya kembali lewat "Lupa sandi" (kode SMS). Tambahkan langkah
        OTP saat daftar kalau penyerobotan nomor mulai terjadi.
      */
      const buat = await kirim("/admin/users", {
        phone,
        password: sandi,
        phone_confirm: true,
        user_metadata: { full_name: nama, role: peran },
      });
      if (!buat.ok) {
        if (buat.j.error_code === "phone_exists")
          throw new GalatAkun(GALAT_HP_TERDAFTAR, 409);
        if (buat.j.error_code === "weak_password")
          throw new GalatAkun(
            "Kata sandinya terlalu mudah ditebak. Coba gabungkan huruf dan angka.",
            422,
          );
        console.error("Supabase Auth menolak pendaftaran:", buat.j);
        throw new GalatAkun(
          "Akun belum bisa dibuat. Coba lagi sebentar lagi.",
          502,
        );
      }

      const masuk = await kirim("/token?grant_type=password", {
        phone,
        password: sandi,
      });
      const j = masuk.j;
      if (!masuk.ok || !j.access_token || !j.refresh_token || !j.user?.id) {
        /* Akunnya sudah jadi — mendaftar ulang hanya akan dijawab "sudah
           terdaftar", jadi arahkan langsung ke layar masuk. */
        throw new GalatAkun(
          "Akunmu sudah jadi, tapi belum bisa masuk otomatis. Masuk pakai nomor dan sandi tadi.",
          502,
        );
      }
      return {
        penggunaId: j.user.id,
        sesi: {
          accessToken: j.access_token,
          refreshToken: j.refresh_token,
          expiresIn: j.expires_in ?? 3600,
        },
      };
    },
  };
}
