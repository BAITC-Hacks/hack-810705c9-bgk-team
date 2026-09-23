import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalDatabase = globalThis as typeof globalThis & {
  taskMatchPool?: Pool;
};

// Next.js refreshes modules during development; preserve the existing pool.
export const pool =
  globalDatabase.taskMatchPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL_NEXTJS,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") globalDatabase.taskMatchPool = pool;

export const db = drizzle(pool, { schema });
export type Database = typeof db;
