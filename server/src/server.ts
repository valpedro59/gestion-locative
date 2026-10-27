import { createApp } from "./app";
import { db } from "./db/client";
import { env } from "./lib/env";

createApp(db).listen(env.PORT, () => {
  console.log(`API prête sur le port ${env.PORT}`);
});
