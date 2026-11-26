import { teruskan } from "@/lib/api";

/* Seluruh /api/* dilayani API Elysia di server/src — lihat src/lib/api.ts. */
export {
  teruskan as GET,
  teruskan as POST,
  teruskan as PUT,
  teruskan as PATCH,
  teruskan as DELETE,
};
