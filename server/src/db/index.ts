import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof buatDb>;

export function buatDb(url: string) {
  /* prepare: false — Supabase transaction pooler tidak mendukung prepared
     statement. Aman juga dipakai lewat session pooler. */
  const sql = postgres(url, { prepare: false });
  return drizzle(sql, { schema, casing: "snake_case" });
}

export { schema };
