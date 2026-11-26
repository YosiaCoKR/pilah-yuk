import { rakitApp } from "../../server/src/rakit";
import { createClient } from "./supabase/server";

/* Satu instance per proses: koneksi Postgres ikut dipakai ulang antar
   request (Fluid Compute menjalankan banyak request di instance yang sama). */
let app: ReturnType<typeof rakitApp> | undefined;
const api = () => (app ??= rakitApp());

type Sesi = { accessToken: string; refreshToken: string };

/** Rute yang menjawab dengan sesi baru: cookie-nya dipasang di sini. */
const MEMBERI_SESI = new Set([
  "/api/akun/masuk",
  "/api/akun/daftar/verifikasi",
]);

/**
 * Teruskan request ke API Elysia di proses yang sama.
 *
 * Token TIDAK pernah dipegang JavaScript browser: sesi disimpan di cookie
 * Supabase (dibuat `setSession`, disegarkan `src/proxy.ts`), lalu di sini
 * diubah jadi `Authorization: Bearer` yang dibaca `server/src/auth.ts`.
 */
export async function teruskan(req: Request): Promise<Response> {
  const supabase = await createClient();
  const { pathname } = new URL(req.url);

  const headers = new Headers(req.headers);
  /* Header pengembangan tidak boleh dioper dari luar, apa pun isi env. */
  headers.delete("x-user-id");
  const { data } = await supabase.auth.getSession();
  if (data.session)
    headers.set("authorization", `Bearer ${data.session.access_token}`);

  /* Dirakit dari bagian-bagiannya: `new Request(nextRequest, …)` gagal di
     Next ("Cannot read private member #state"). */
  const adaBadan = req.method !== "GET" && req.method !== "HEAD";
  const res = await api().handle(
    new Request(req.url, {
      method: req.method,
      headers,
      body: adaBadan ? await req.arrayBuffer() : undefined,
    }),
  );

  if (pathname === "/api/akun/keluar") {
    await supabase.auth.signOut({ scope: "local" });
    return res;
  }
  if (!MEMBERI_SESI.has(pathname) || !res.ok) return res;

  const isi = (await res.json()) as { data: { sesi: Sesi } };
  await supabase.auth.setSession({
    access_token: isi.data.sesi.accessToken,
    refresh_token: isi.data.sesi.refreshToken,
  });
  /* Sesi sudah di cookie httpOnly; browser tidak perlu melihat tokennya. */
  delete (isi.data as Partial<typeof isi.data>).sesi;
  return Response.json(isi, { status: res.status });
}

/**
 * Baca data API dari Server Component. `null` = belum masuk (401) atau
 * tidak ada (404); galat lain dilempar supaya muncul di error boundary.
 */
export async function ambil<T>(path: string): Promise<T | null> {
  const res = await teruskan(new Request(`http://pilah-yuk.internal${path}`));
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return ((await res.json()) as { data: T }).data;
}
