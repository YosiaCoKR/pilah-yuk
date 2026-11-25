import { createBrowserClient } from "@supabase/ssr";

/** Klien Supabase untuk Client Component ("use client"). */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
