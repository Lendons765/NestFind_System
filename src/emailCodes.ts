import { createHash, randomInt, randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "./db.js";
import { pool } from "./db.js";

export const CODE_TTL_MINUTES = 15;
export type CodePurpose = "verify" | "reset";

// The code is stored as a hash, so the database never holds a usable code.
function hashCode(purpose: CodePurpose, userId: string, code: string) {
  return createHash("sha256").update(`${purpose}:${userId}:${code}`).digest("hex");
}

// Creates a new 6-digit code. Older unused codes of the same kind stop working.
// Expiry is set by the database clock, so the time zone of this computer doesn't matter.
export async function createCode(userId: string, purpose: CodePurpose): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await pool.query(
    "UPDATE email_tokens SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
    [userId, purpose]
  );
  await pool.query(
    `INSERT INTO email_tokens (id, user_id, purpose, token_hash, payload, expires_at)
     VALUES (?, ?, ?, ?, '{}', NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes')`,
    [randomUUID(), userId, purpose, hashCode(purpose, userId, code)]
  );
  return code;
}

// Returns true only for a correct, unused, unexpired code, and uses it up.
export async function consumeCode(userId: string, purpose: CodePurpose, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM email_tokens
     WHERE user_id = ? AND purpose = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [userId, purpose, hashCode(purpose, userId, code)]
  );
  const row = rows[0];
  if (!row) return false;

  const [marked] = await pool.query<ResultSetHeader>(
    "UPDATE email_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
    [row.id]
  );
  return marked.affectedRows === 1;
}