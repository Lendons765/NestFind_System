import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { sendEmail } from "../mailer.js";

export const passwordRouter = Router();

const TOKEN_TTL_MINUTES = 60;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// POST /api/auth/password/forgot
// Body: { email }
// Always returns the same reply, so the form can't reveal which emails have accounts.
passwordRouter.post("/forgot", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const generic = { message: "If an account exists for this email, a reset link is on its way." };

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, full_name FROM users WHERE email = ?",
    [email]
  );
  const user = rows[0];
  if (!user) return res.json(generic);

  const token = randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO email_tokens (id, user_id, purpose, token_hash, payload, expires_at)
     VALUES (?, ?, 'reset', ?, '{}', ?)`,
    [randomUUID(), user.id, sha256(token), new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)]
  );

  const base = process.env.APP_URL ?? "http://localhost:5173";
  await sendEmail(
    email,
    "Reset your NestFind password",
    `Hi ${user.full_name},\n\n` +
      `Reset your password here (valid for ${TOKEN_TTL_MINUTES} minutes):\n` +
      `${base}/reset?token=${token}\n\n` +
      `If you didn't ask for this, ignore this email.`
  );
  return res.json(generic);
});

// POST /api/auth/password/reset
// Body: { token, password }
passwordRouter.post("/reset", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const invalid = () => res.status(400).json({ error: "This reset link is invalid or has expired." });

  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: "Password must be 8 to 72 characters." });
  }
  if (!token) return invalid();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, user_id, purpose, expires_at, used_at FROM email_tokens WHERE token_hash = ?",
    [sha256(token)]
  );
  const row = rows[0];
  if (!row) return invalid();
  if (row.purpose !== "reset" || row.used_at != null) return invalid();
  const expiresAt = row.expires_at;
  if (expiresAt == null || new Date(expiresAt) < new Date()) return invalid();

  // Mark the link as used first, so it can't be clicked twice.
  const [marked] = await pool.query<ResultSetHeader>(
    "UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
    [new Date(), row.id]
  );
  if (marked.affectedRows === 0) return invalid();

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    "UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?",
    [passwordHash, new Date(), row.user_id]
  );

  return res.json({ message: "Your password has been reset. You can log in now." });
});