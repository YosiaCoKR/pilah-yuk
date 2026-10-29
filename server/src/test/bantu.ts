/** Perkakas bersama untuk pemeriksaan: Postgres sementara + app yang sama. */

/* Membuka jalur identitas lewat header `x-user-id` untuk pemeriksaan saja.
   Di luar sini auth.ts gagal tertutup — lihat komentarnya. */
process.env.AUTH_DEV_HEADER = "1";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { buatApp } from "../app";
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

/** Hak tabel yang di Supabase sudah terpasang sejak awal. */
export async function beriHakSupabase(klien: PGlite) {
  await klien.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public
      to authenticated, service_role;
  `);
}

export async function siapkan() {
  const klien = new PGlite();
  await pasangPrasyaratSupabase(klien);
  for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    for (const s of readFileSync(join(DIR, f), "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (s.trim()) await klien.exec(s);
    }
  }
  await beriHakSupabase(klien);

  const db = drizzle(klien, { schema, casing: "snake_case" }) as unknown as Db;
  const app = buatApp(db);

  async function panggil(
    method: string,
    path: string,
    opts: { sebagai?: string; body?: unknown } = {},
  ): Promise<{ status: number; body: any }> {
    const res = await app.handle(
      new Request(`http://local${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(opts.sebagai ? { "x-user-id": opts.sebagai } : {}),
        },
        ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      }),
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  return { klien, db, app, panggil, schema };
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
