/** Perkakas bersama untuk pemeriksaan: Postgres sementara + app yang sama. */

/* Membuka jalur identitas lewat header `x-user-id` untuk pemeriksaan saja.
   Di luar sini auth.ts gagal tertutup — lihat komentarnya. */
process.env.AUTH_DEV_HEADER = "1";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  GalatAkun,
  GALAT_KODE,
  GALAT_MASUK,
  keE164,
  type PenyediaAkun,
} from "../akun";
import { buatApp } from "../app";
import { badanCharge, type Gateway } from "../pembayaran";
import type { Db } from "../db";
import * as schema from "../db/schema";

const DIR = new URL("../../drizzle/", import.meta.url).pathname;

/**
 * Bagian Supabase yang TIDAK ada di PGlite.
 *
 * Migrasi RLS memasang kebijakan `TO authenticated` yang memanggil
 * `auth.uid()`. Di Supabase keduanya sudah ada; di Postgres kosong tidak.
 * Ditiru di sini supaya migrasi yang dijalankan pemeriksaan adalah migrasi
 * yang SAMA dengan yang jalan di produksi — bukan versi yang dipangkas.
 *
 * `auth.uid()` dibaca dari setting `request.jwt.claim.sub`, persis seperti
 * PostgREST menyetelnya, jadi pemeriksaan bisa "menjadi" warga tertentu.
 */
export async function pasangPrasyaratSupabase(klien: PGlite) {
  await klien.exec(`
    create schema if not exists auth;
    /* Hanya kolom yang dibaca trigger profil (migrasi 0012–0013). */
    create table if not exists auth.users (
      id uuid primary key,
      email text,
      phone text,
      raw_user_meta_data jsonb,
      phone_confirmed_at timestamptz,
      email_confirmed_at timestamptz
    );
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
    do $$ begin
      /* Publikasi yang dibaca Realtime. Di Supabase sudah ada sejak proyek
         dibuat; tanpa ini migrasi realtime akan terlewat diam-diam di
         pemeriksaan, justru bagian yang paling perlu dibuktikan. */
      if not exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
      ) then create publication supabase_realtime; end if;
      if not exists (select 1 from pg_roles where rolname = 'anon')
        then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated')
        then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role')
        then create role service_role; end if;
    end $$;
  `);
}

/** Hak tabel yang di Supabase sudah terpasang sejak awal — termasuk `anon`:
    yang menahan pemegang anon key adalah RLS, bukan GRANT. */
export async function beriHakSupabase(klien: PGlite) {
  await klien.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public
      to anon, authenticated, service_role;
  `);
}

/**
 * Penyedia pembayaran tiruan untuk pemeriksaan.
 *
 * Tetap melewati `badanCharge`, jadi kanal yang tidak dilayani Core API
 * (Mandiri, OVO, DANA) ditolak di sini sama seperti di produksi — tiruan yang
 * meluluskan semuanya akan menyembunyikan justru aturan itu.
 */
export function buatGatewayTiruan(): Gateway & { dimatikan: string[] } {
  const dimatikan: string[] = [];
  return {
    dimatikan,
    tagih: async (p) => {
      badanCharge(p);
      return {
        providerRef: `MT-${p.code}`,
        qrUrl: p.method === "qris" ? `https://contoh.test/qr/${p.code}` : null,
        vaNumber: p.method === "va_bank" ? "8277081234567890" : null,
        deeplink:
          p.method === "ewallet"
            ? `https://contoh.test/deeplink/${p.code}`
            : null,
      };
    },
    batalkan: async (code) => {
      dimatikan.push(code);
      return true;
    },
  };
}

/** Satu-satunya kode SMS yang diterima Supabase Auth tiruan. */
export const KODE_UJI = "123456";

/**
 * Supabase Auth tiruan: menulis ke `auth.users` PGlite, jadi trigger profil
 * (migrasi 0012) yang membuat baris `users` — bukan tiruan ini.
 */
export function buatAkunTiruan(
  klien: PGlite,
): PenyediaAkun & { dicabut: string[]; dikirimKode: string[] } {
  const sandiPer = new Map<
    string,
    { id: string; sandi: string | null; aktif: boolean }
  >();
  const dicabut: string[] = [];
  const dikirimKode: string[] = [];
  const sesi = (id: string) => ({
    penggunaId: id,
    sesi: {
      accessToken: `akses-${id}`,
      refreshToken: "segar",
      expiresIn: 3600,
    },
  });
  return {
    dicabut,
    dikirimKode,
    async kirimKode(hp, buatAkun = true) {
      /* Seperti `/otp` + create_user: akun tanpa sandi, belum terkonfirmasi. */
      dikirimKode.push(hp);
      if (sandiPer.has(hp) || !buatAkun) return;
      const r = await klien.query<{ id: string }>(
        `insert into auth.users (id, phone) values (gen_random_uuid(), $1) returning id`,
        [keE164(hp)],
      );
      sandiPer.set(hp, { id: r.rows[0].id, sandi: null, aktif: false });
    },
    async verifikasi(hp, kode, { sandi }) {
      const akun = sandiPer.get(hp);
      if (!akun || kode !== KODE_UJI) throw new GalatAkun(GALAT_KODE, 422);
      await klien.query(
        `update auth.users set phone_confirmed_at = now() where id = $1`,
        [akun.id],
      );
      Object.assign(akun, { sandi, aktif: true });
      return sesi(akun.id);
    },
    async aturUlangSandi(hp, kode, sandi) {
      const akun = sandiPer.get(hp);
      if (!akun?.aktif || kode !== KODE_UJI)
        throw new GalatAkun(GALAT_KODE, 422);
      akun.sandi = sandi;
      dicabut.push(`semua:${akun.id}`);
    },
    async masuk(hp, sandi) {
      const akun = sandiPer.get(hp);
      if (!akun?.aktif || akun.sandi !== sandi)
        throw new GalatAkun(GALAT_MASUK, 401);
      return sesi(akun.id);
    },
    async keluar(token) {
      dicabut.push(token);
    },
  };
}

/* `null` = tanpa penyedia (menguji gagal-tertutup). Bukan `undefined`:
   parameter berdefault tetap jatuh ke defaultnya saat diberi undefined. */
/** Server key tiruan: dipakai menghitung tanda tangan webhook di pemeriksaan. */
export const KUNCI_UJI = "SB-Mid-server-UJICOBA";

export async function siapkan(gateway: Gateway | null = buatGatewayTiruan()) {
  const klien = new PGlite();
  await pasangPrasyaratSupabase(klien);
  for (const f of readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const s of readFileSync(join(DIR, f), "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (s.trim()) await klien.exec(s);
    }
  }
  await beriHakSupabase(klien);

  const db = drizzle(klien, { schema, casing: "snake_case" }) as unknown as Db;
  const akun = buatAkunTiruan(klien);
  const app = buatApp(db, gateway ?? undefined, KUNCI_UJI, akun);

  async function panggil(
    method: string,
    path: string,
    opts: {
      sebagai?: string;
      body?: unknown;
      kepala?: Record<string, string>;
    } = {},
  ): Promise<{ status: number; body: any }> {
    const res = await app.handle(
      new Request(`http://local${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(opts.sebagai ? { "x-user-id": opts.sebagai } : {}),
          ...opts.kepala,
        },
        ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      }),
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  return { klien, db, app, panggil, schema, gateway, akun };
}

export const lulus = (label: string) => console.log(`  ✓ ${label}`);

/**
 * Langganan aktif untuk warga, supaya pemeriksaan rute lain tidak tersandung
 * gerbang langganan. Kembalikan id paket dan langganan.
 */
export async function berlangganan(
  db: any,
  schema: any,
  penggunaId: string,
  opsi: {
    status?: "aktif" | "kedaluwarsa" | "menunggu_bayar";
    kuota?: number;
    mulai?: string;
    sampai?: string;
  } = {},
) {
  const [paket] = await db
    .insert(schema.subscriptionPlans)
    .values({
      name: "Bulanan Rumah Tangga",
      billingCycle: "bulanan",
      price: 45000,
      pickupQuota: opsi.kuota ?? 8,
    })
    .returning();

  const [langganan] = await db
    .insert(schema.subscriptions)
    .values({
      userId: penggunaId,
      planId: paket.id,
      status: opsi.status ?? "aktif",
      startDate: opsi.mulai ?? tanggalISO(-10),
      endDate: opsi.sampai ?? tanggalISO(20),
    })
    .returning();

  return { paket, langganan };
}

/** ISO yyyy-mm-dd, `geser` hari dari hari ini. */
export function tanggalISO(geser = 0) {
  const d = new Date();
  d.setDate(d.getDate() + geser);
  return d.toISOString().slice(0, 10);
}
