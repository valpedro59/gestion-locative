import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../lib/env";
import * as schema from "./schema";

// Pool TCP (et non le driver HTTP de Neon) : nécessaire pour les transactions.
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
export const db = drizzle(pool, { schema });
