import { env } from "./env";
import { rakitApp } from "./rakit";

rakitApp().listen(env.port, ({ hostname, port }) => {
  console.log(`Pilah Yuk API jalan di http://${hostname}:${port}`);
});
