import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db/types";

// Base Postgres en mémoire, avec les vraies migrations SQL appliquées dans l'ordre.
export async function createTestDb() {
  const client = new PGlite();
  const dir = join(__dirname, "..", "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.exec(readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  return drizzle(client, { schema }) as unknown as Database;
}
