import { Pool } from "pg";
import "dotenv/config";

// Same names the route files import from mysql2.
export type RowDataPacket = Record<string, any>;
export type ResultSetHeader = { affectedRows: number; insertId?: number | string };

const host = process.env.DB_HOST ?? "";
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";

const pgPool = new Pool({
  host,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Render requires encrypted connections from outside its network.
  // SSL turns on automatically for any non-local host, or when DB_SSL=true.
  ssl:
    process.env.DB_SSL === "true" || !isLocal
      ? { rejectUnauthorized: false }
      : undefined,
  max: 10,
});

// Turns MySQL-style "?" placeholders into PostgreSQL "$1, $2, ..." placeholders.
function toPositional(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// Runs a query and returns [rows], matching mysql2's shape.
async function run<T>(db: any, sql: string, params: unknown[] = []): Promise<[T, undefined]> {
  const res = await db.query(toPositional(sql), params);
  const rows = res.rows as Record<string, any>[] & { affectedRows?: number };
  rows.affectedRows = res.rowCount ?? 0;
  return [rows as unknown as T, undefined];
}

export const pool = {
  query: <T = RowDataPacket[]>(sql: string, params: unknown[] = []) =>
    run<T>(pgPool, sql, params),

  async getConnection() {
    const client = await pgPool.connect();
    return {
      query: <T = RowDataPacket[]>(sql: string, params: unknown[] = []) =>
        run<T>(client, sql, params),
      beginTransaction: () => client.query("BEGIN"),
      commit: () => client.query("COMMIT"),
      rollback: () => client.query("ROLLBACK"),
      release: () => client.release(),
    };
  },
};