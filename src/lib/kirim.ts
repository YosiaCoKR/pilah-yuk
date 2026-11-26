import { GALAT_JARINGAN } from "./akun";

export type Jawaban<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      pesan: string;
      /** Galat per kolom dari validasi server, kunci = nama kolom. */
      rincian: Record<string, string>;
    };

/**
 * Panggil `/api/*` dari browser. Tidak pernah melempar: jaringan putus dan
 * jawaban galat sama-sama jadi `{ ok: false, pesan }` yang siap ditampilkan.
 * Sesi dibawa cookie, jadi tidak ada token yang perlu dioper di sini.
 */
export async function kirim<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  badan?: unknown,
): Promise<Jawaban<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers:
        badan === undefined
          ? undefined
          : { "content-type": "application/json" },
      body: badan === undefined ? undefined : JSON.stringify(badan),
    });
  } catch {
    return { ok: false, status: 0, pesan: GALAT_JARINGAN, rincian: {} };
  }
  const isi = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, data: isi.data as T };
  return {
    ok: false,
    status: res.status,
    pesan: isi.pesan ?? "Ada gangguan di server. Coba lagi sebentar lagi.",
    rincian: Object.fromEntries(
      (isi.rincian ?? []).map((r: { kolom: string; pesan: string }) => [
        r.kolom,
        r.pesan,
      ]),
    ),
  };
}
