import "dotenv/config";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pool } from "../src/db.js";
import type { RowDataPacket } from "../src/db.js";

const UPLOAD_DIR = path.resolve("uploads");

async function main() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.listing_id, m.storage_url, l.title
     FROM listing_media m JOIN listings l ON l.id = m.listing_id
     WHERE m.media_type = 'photo'`
  );

  const tracked = new Set<string>();
  for (const r of rows) {
    const file = path.basename(r.storage_url);
    tracked.add(file);
    if (!existsSync(path.join(UPLOAD_DIR, file))) {
      console.log(`MISSING FILE  ${r.title}  ->  ${file}`);
    }
  }

  for (const file of readdirSync(UPLOAD_DIR)) {
    if (!tracked.has(file)) console.log(`UNTRACKED FILE  ${file}`);
  }

  console.log(`Checked ${rows.length} photo rows in ${UPLOAD_DIR}`);
  await pool.end();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());