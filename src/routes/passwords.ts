import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { sendEmail } from "../mailer.js";
import { CODE_TTL_MINUTES, consumeCode, createCode } from "../emailCodes.js";

export const passwordRouter = Router();

const LINK_TTL_MINUTES = 60;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:5173";
}

// POST /api/auth/password/forgot
// Body: { email }. Emails a 6-digit code and a reset link. Same reply either way.
passwordRouter.post("/forgot", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const generic = { message: "If an account exists for this email, a reset code and link are on their way." };

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, full_name FROM users WHERE email = ?",
    [email]
  );
  const user = rows[0];
  if (!user) return res.json(generic);

  const code = await createCode(user.id, "reset");

  const token = randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO email_tokens (id, user_id, purpose, token_hash, payload, expires_at)
     VALUES (?, ?, 'reset', ?, '{}', NOW() + INTERVAL '${LINK_TTL_MINUTES} minutes')`,
    [randomUUID(), user.id, sha256(token)]
  );

  const base = appUrl();
  await sendEmail(
    email,
    "Reset your NestFind password",
    `Hi ${user.full_name},\n\n` +
      `Your reset code is: ${code}\n` +
      `Enter it at ${base}/reset?email=${encodeURIComponent(email)} (valid for ${CODE_TTL_MINUTES} minutes).\n\n` +
      `Or reset with this link (valid for ${LINK_TTL_MINUTES} minutes):\n` +
      `${base}/reset?token=${token}\n\n` +
      `If you didn't ask for this, ignore this email.`
  );
  return res.json(generic);
});

// POST /api/auth/password/reset
// Either { email, code, password } or { token, password }.
passwordRouter.post("/reset", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const invalid = () => res.status(400).json({ error: "This reset link or code is invalid or has expired." });
  const done = () => res.json({ message: "Your password has been reset. You can log in now." });

  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: "Password must be 8 to 72 characters." });
  }

  // Path 1: 6-digit code
  if (code) {
    if (!email) return invalid();
    const [users] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user || !(await consumeCode(user.id, "reset", code))) return invalid();

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      "UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?",
      [passwordHash, user.id]
    );
    return done();
  }

  // Path 2: reset link
  if (!token) return invalid();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, user_id, purpose, expires_at, used_at FROM email_tokens WHERE token_hash = ?",
    [sha256(token)]
  );
  const row = rows[0];
  if (!row || row.purpose !== "reset" || row.used_at != null) return invalid();
  if (row.expires_at == null || new Date(row.expires_at) < new Date()) return invalid();

  const [marked] = await pool.query<ResultSetHeader>(
    "UPDATE email_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
    [row.id]
  );
  if (marked.affectedRows === 0) return invalid();

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    "UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?",
    [passwordHash, row.user_id]
  );
  return done();
});