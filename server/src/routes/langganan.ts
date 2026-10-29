import { Elysia } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { ringkasLangganan } from "../langganan";

export const ruteLangganan = (db: Db) =>
  new Elysia({ prefix: "/langganan" })
    .use(auth)
    .get("/saya", async ({ penggunaId }) => ({
      data: await ringkasLangganan(db, penggunaId),
    }));
