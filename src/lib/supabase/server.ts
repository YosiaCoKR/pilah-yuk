import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie sesi hanya dibaca server (src/lib/api.ts, src/proxy.ts) — tidak ada
 * klien Supabase di browser — jadi JavaScript halaman tidak perlu, dan tidak
 * boleh, bisa membaca tokennya.
 */
export const OPSI_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;

/**
 * Klien Supabase KHUSUS AUTH (simpan/segarkan sesi di cookie) untuk Server
 * Component dan Route Handler — tidak pernah untuk `.from()`.
 *
 * Kuncinya service key, sama seperti `buatSupabaseAuth` di server/src/akun.ts:
 * proyeknya satu dengan backend, dan kunci ini tidak pernah keluar dari
 * server (tidak ada klien Supabase di browser). Data warga tetap lewat API
 * Elysia, yang memeriksa token warga sendiri.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookieOptions: OPSI_COOKIE,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(daftar) {
          try {
            daftar.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Dipanggil dari Server Component (cookie read-only) — aman
               diabaikan karena src/proxy.ts yang menyegarkan sesi. */
          }
        },
      },
    },
  );
}
