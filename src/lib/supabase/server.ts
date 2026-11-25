import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Klien Supabase untuk Server Component / Server Action / Route Handler. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
