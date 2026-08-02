import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "@/db/schema";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPglite?: PGlite;
};

const client = globalForDb.__arenaNextJsPglite ?? new PGlite("./pgdata");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPglite = client;
}

export const db = drizzle(client, { schema });
