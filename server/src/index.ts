import { buatApp } from "./app";
import { buatDb } from "./db";
import { env } from "./env";

buatApp(buatDb(env.databaseUrl)).listen(env.port, ({ hostname, port }) => {
  console.log(`Pilah Yuk API jalan di http://${hostname}:${port}`);
});
