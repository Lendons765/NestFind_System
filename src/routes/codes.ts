import { Router } from "express";
import type { RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { consumeCode, createCode } from "../emailCodes.js";
import { sendEmail } from "../mailer.js";

export const codesRouter = Router();

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// POST /api/auth/codes/verify
// Body: { email, code }. Marks the email as verified.
codesRouter.post("/verify", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE email = ?", [email]);
  const user = rows[0];
  if (!user || !(await consumeCode(user.id, "verify", code))) {
    return res.status(400).json({ error: "That code is invalid or has expired." });
  }

  await pool.query("UPDATE users SET email_verified_at = NOW() WHERE id = ?", [user.id]);
  return res.json({ verified: true });
});

// POST /api/auth/codes/resend
// Body: { email }. Same reply whether or not the account exists.
codesRouter.post("/resend", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const generic = { message: "If this email has an unverified account, a new code is on its way." };

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, full_name, email_verified_at FROM users WHERE email = ?",
    [email]
  );
  const user = rows[0];
  if (!user || user.email_verified_at) return res.json(generic);

  const code = await createCode(user.id, "verify");
  await sendEmail(
    email,
    "Your NestFind verification code",
    `Hi ${user.full_name},\n\nYour verification code is: ${code}\n\nIt expires in 15 minutes.`
  );
  return res.json(generic);
});