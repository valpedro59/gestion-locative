import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

// Accepte aussi bien le driver node-postgres (production) que PGlite (tests).
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
