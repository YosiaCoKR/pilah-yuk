import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Menyegarkan sesi Supabase di setiap request halaman: token yang hampir
 * kedaluwarsa ditukar baru, lalu cookie-nya ditulis ke request (untuk
 * Server Component) dan ke response (untuk browser).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(daftar) {
          daftar.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          daftar.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /* Panggilan inilah yang memicu penyegaran token — tanpa ini setAll di
     atas tidak pernah jalan. Jangan sisipkan kode di antaranya. */
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
