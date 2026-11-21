import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { requireAuth, signToken } from "../auth.js";
import { sendEmail } from "../mailer.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_HOURS = 24;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:5173";
}

// Stores only a hash of the link token, so a leaked database can't be used to claim accounts.
async function createClaimToken(
  userId: string,
  payload: { fullName: string; passwordHash: string }
) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO email_tokens (id, user_id, purpose, token_hash, payload, expires_at)
     VALUES (?, ?, 'claim', ?, ?, ?)`,
    [randomUUID(), userId, sha256(token), JSON.stringify(payload), expiresAt]
  );
  return token;
}

// POST /api/auth/register
// New emails create an account and return a message. The user then logs in on the login page.
// An email that belongs to an inquiry account (no password yet) is not taken over
// immediately: a confirmation link is sent to that address first.
authRouter.post("/register", async (req, res) => {
  const body = req.body ?? {};
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  // Admins can't be created through the public API.
  const role = body.role === "owner" ? "owner" : "tenant";

  if (!fullName || fullName.length > 255) {
    return res.status(400).json({ error: "Full name is required." });
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected.
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: "Password must be 8 to 72 characters." });
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id, role, password_hash FROM users WHERE email = ?",
    [email]
  );

  const account = existing[0];
  if (account) {
    if (account.password_hash === null && account.role === "tenant") {
      const passwordHash = await bcrypt.hash(password, 12);
      const token = await createClaimToken(account.id, { fullName, passwordHash });
      await sendEmail(
        email,
        "Confirm your NestFind account",
        `Hi ${fullName},\n\n` +
          `Confirm your email to finish setting up your NestFind account:\n` +
          `${appUrl()}/verify?token=${token}\n\n` +
          `This link expires in ${TOKEN_TTL_HOURS} hours. If you didn't request this, ignore this email.`
      );
      return res.status(202).json({
        status: "verification_sent",
        message: "Check your email to confirm your account.",
      });
    }
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (id, role, full_name, email, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [id, role, fullName, email, passwordHash]
  );

  // No token here: the user logs in on the login page after creating the account.
  return res.status(201).json({
    status: "registered",
    message: "Account created. Please log in with your email and password.",
  });
});

// GET /api/auth/verify?token=...
// Confirms a claim link: applies the saved name and password, then logs the user in.
authRouter.get("/verify", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const invalid = () =>
    res.status(400).json({ error: "This link is invalid or has expired." });

  if (!token) return invalid();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, user_id, purpose, payload, expires_at, used_at FROM email_tokens WHERE token_hash = ?",
    [sha256(token)]
  );
  const row = rows[0];
  if (!row || row.purpose !== "claim" || row.used_at !== null) return invalid();
  if (new Date(row.expires_at) < new Date()) return invalid();

  // Mark the link as used before changing anything, so it can't be clicked twice.
  const [marked] = await pool.query<ResultSetHeader>(
    "UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
    [new Date(), row.id]
  );
  if (marked.affectedRows === 0) return invalid();

  const payload = JSON.parse(row.payload) as { fullName: string; passwordHash: string };
  await pool.query(
    "UPDATE users SET full_name = ?, password_hash = ?, email_verified_at = ? WHERE id = ?",
    [payload.fullName, payload.passwordHash, new Date(), row.user_id]
  );

  const [users] = await pool.query<RowDataPacket[]>(
    "SELECT id, role, full_name, email FROM users WHERE id = ?",
    [row.user_id]
  );
  const user = users[0];
  if (!user) return invalid();

  const sessionToken = signToken({ id: user.id, role: user.role });
  return res.json({
    token: sessionToken,
    user: {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
      email: user.email,
    },
  });
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, role, full_name, email, password_hash FROM users WHERE email = ?",
    [email]
  );
  const user = rows[0];

  // Same message for "no account" and "wrong password", so emails can't be guessed.
  const valid = user?.password_hash && (await bcrypt.compare(password, user.password_hash));
  if (!user || !valid) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }

  const token = signToken({ id: user.id, role: user.role });
  return res.json({
    token,
    user: { id: user.id, role: user.role, fullName: user.full_name, email: user.email },
  });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, role, full_name, email FROM users WHERE id = ?",
    [req.user!.id]
  );
  const user = rows[0];
  if (!user) {
    return res.status(404).json({ error: "Account not found." });
  }
  return res.json({
    id: user.id,
    role: user.role,
    fullName: user.full_name,
    email: user.email,
  });
});