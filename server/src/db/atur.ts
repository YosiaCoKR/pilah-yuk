/**
 * Setup DB sekali jalan: npm run db:atur
 * Minta password DB, tes dulu ke Supabase, baru tulis ke .env kalau benar
 * (sudah di-encode, jadi # dan simbol lain aman), lalu migrasi + seed.
 * Beda dengan `drizzle-kit migrate`: error-nya kelihatan, tidak diam.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const teks = readFileSync(".env", "utf8");
const baris = teks.match(/^DATABASE_URL=.*$/m)?.[0];
if (!baris) throw new Error("Baris DATABASE_URL tidak ada di .env");
const u = new URL(
  baris
    .slice("DATABASE_URL=".length)
    .trim()
    .replace(/^["']|["']$/g, ""),
);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pw = (
  await rl.question(
    `Password DB proyek ${u.username.split(".")[1]} (ketik apa adanya, tanpa %23): `,
  )
).trim();
rl.close();
if (!pw) process.exit(1);
const url = `postgresql://${u.username}:${encodeURIComponent(pw)}@${u.host}${u.pathname}`;

const sql = postgres(url, { max: 1, onnotice() {}, connect_timeout: 15 });
try {
  await sql`select 1`;
} catch (e: any) {
  console.log(
    `\n❌ Ditolak: ${e.message}\n.env TIDAK diubah. Reset password di Supabase → Project Settings → Database (huruf+angka saja), tunggu 1 menit, lalu ulangi.`,
  );
  await sql.end();
  process.exit(1);
}
writeFileSync(".env", teks.replace(baris, `DATABASE_URL=${url}`));
console.log("✅ Password benar, .env diperbarui.\n⏳ Menjalankan migrasi…");

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  const [r] =
    await sql`select count(*)::int n from drizzle.__drizzle_migrations`;
  console.log(`✅ Migrasi beres (${r.n} tercatat).`);
} catch (e: any) {
  console.log(
    `❌ Migrasi gagal: ${e.message}\n   sebab: ${e.cause?.message ?? "-"}`,
  );
  process.exit(1);
} finally {
  await sql.end();
}

console.log("⏳ Mengisi data awal (seed)…");
const seed = spawnSync("bun", ["run", "src/db/seed.ts"], { stdio: "inherit" });
console.log(
  seed.status === 0
    ? "\n🎉 Selesai. Sekarang: npm run dev"
    : "\n❌ Seed gagal — tempel pesannya ke Claude.",
);
