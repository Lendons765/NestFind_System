import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const ownerExtrasRouter = Router();

// Every route here needs a logged-in owner.
ownerExtrasRouter.use(requireAuth, requireRole("owner"));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A tenant counts as connected if they inquired, applied, or booked a viewing on this owner's listings.
async function isConnectedTenant(tenantId: string, ownerId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id FROM users u
     WHERE u.id = ? AND u.role = 'tenant' AND (
       EXISTS (SELECT 1 FROM conversations c WHERE c.tenant_id = u.id AND c.owner_id = ?)
       OR EXISTS (SELECT 1 FROM applications a JOIN listings l ON l.id = a.listing_id
                  WHERE a.tenant_id = u.id AND l.owner_id = ?)
       OR EXISTS (SELECT 1 FROM viewings v JOIN listings l ON l.id = v.listing_id
                  WHERE v.tenant_id = u.id AND l.owner_id = ?)
     )`,
    [tenantId, ownerId, ownerId, ownerId]
  );
  return rows[0] !== undefined;
}

// ---------- Own account ----------

// GET /api/owner/extras/account
ownerExtrasRouter.get("/account", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, full_name, email, phone, created_at FROM users WHERE id = ? AND role = 'owner'",
    [req.user!.id]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "Account not found." });
  return res.json({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone ?? null,
    createdAt: user.created_at,
  });
});

// PUT /api/owner/extras/account
// Body: { fullName, phone? }. Email and password are changed through their own verified flows.
ownerExtrasRouter.put("/account", async (req, res) => {
  const input = req.body ?? {};
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const phone = typeof input.phone === "string" && input.phone.trim() ? input.phone.trim() : null;

  if (!fullName || fullName.length > 255) {
    return res.status(400).json({ error: "Full name is required (255 characters max)." });
  }
  if (phone && (phone.length > 32 || !/^[0-9+\-\s()]+$/.test(phone))) {
    return res.status(400).json({ error: "Enter a valid phone number." });
  }

  try {
    await pool.query(
      "UPDATE users SET full_name = ?, phone = ? WHERE id = ? AND role = 'owner'",
      [fullName, phone, req.user!.id]
    );
  } catch (err) {
    // 23505 is PostgreSQL's unique-violation code (phone already used by another account).
    if ((err as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "That phone number is already used by another account." });
    }
    throw err;
  }
  return res.json({ saved: true });
});

// ---------- Notes ----------

// GET /api/owner/extras/notes?tenantId=...
ownerExtrasRouter.get("/notes", async (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : "";
  if (tenantId && !UUID_RE.test(tenantId)) return res.status(400).json({ error: "Invalid tenant." });

  const params: unknown[] = [req.user!.id];
  let sql = `SELECT n.id, n.tenant_id, n.body, n.is_done, n.created_at, n.updated_at,
                    u.full_name AS tenant_name
             FROM owner_notes n
             JOIN users u ON u.id = n.tenant_id
             WHERE n.owner_id = ?`;
  if (tenantId) {
    sql += " AND n.tenant_id = ?";
    params.push(tenantId);
  }
  sql += " ORDER BY n.is_done ASC, n.created_at DESC";

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return res.json(
    rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      body: r.body,
      isDone: Number(r.is_done) === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  );
});

// POST /api/owner/extras/notes
// Body: { tenantId, body }
ownerExtrasRouter.post("/notes", async (req, res) => {
  const body = req.body ?? {};
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!UUID_RE.test(tenantId)) return res.status(400).json({ error: "Choose a tenant." });
  if (!text || text.length > 1000) {
    return res.status(400).json({ error: "Write a note (up to 1000 characters)." });
  }
  if (!(await isConnectedTenant(tenantId, req.user!.id))) {
    return res.status(404).json({ error: "This tenant isn't connected to your listings." });
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "INSERT INTO owner_notes (id, owner_id, tenant_id, body) VALUES (?, ?, ?, ?) RETURNING id",
    [randomUUID(), req.user!.id, tenantId, text]
  );
  return res.status(201).json({ id: rows[0]?.id });
});

// PATCH /api/owner/extras/notes/:id
// Body: { body?, isDone? }. Only the note's owner can change it.
ownerExtrasRouter.patch("/notes/:id", async (req, res) => {
  const noteId = String(req.params.id ?? "");
  if (!UUID_RE.test(noteId)) return res.status(404).json({ error: "Note not found." });

  const input = req.body ?? {};
  let text: string | null = null;
  if (input.body !== undefined) {
    text = typeof input.body === "string" ? input.body.trim() : "";
    if (!text || text.length > 1000) {
      return res.status(400).json({ error: "Write a note (up to 1000 characters)." });
    }
  }
  const isDone = typeof input.isDone === "boolean" ? (input.isDone ? 1 : 0) : null;
  if (text === null && isDone === null) {
    return res.status(400).json({ error: "Nothing to update." });
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE owner_notes
     SET body = COALESCE(?, body), is_done = COALESCE(?, is_done)
     WHERE id = ? AND owner_id = ?`,
    [text, isDone, noteId, req.user!.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: "Note not found." });
  return res.json({ id: noteId });
});

// DELETE /api/owner/extras/notes/:id
ownerExtrasRouter.delete("/notes/:id", async (req, res) => {
  const noteId = String(req.params.id ?? "");
  if (!UUID_RE.test(noteId)) return res.status(404).json({ error: "Note not found." });

  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM owner_notes WHERE id = ? AND owner_id = ?",
    [noteId, req.user!.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: "Note not found." });
  return res.json({ deleted: true });
});

// ---------- Owner profile ----------

// GET /api/owner/extras/profile
ownerExtrasRouter.get("/profile", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT business_name, unit_count FROM owner_profiles WHERE user_id = ?",
    [req.user!.id]
  );
  const row = rows[0];
  return res.json({
    exists: row !== undefined,
    businessName: row?.business_name ?? null,
    unitCount: Number(row?.unit_count ?? 0),
  });
});

// PUT /api/owner/extras/profile (create or update)
// Body: { businessName, unitCount }
ownerExtrasRouter.put("/profile", async (req, res) => {
  const input = req.body ?? {};
  const businessName =
    typeof input.businessName === "string" && input.businessName.trim() ? input.businessName.trim() : null;
  const unitCount = Number(input.unitCount ?? 0);

  if (businessName && businessName.length > 255) {
    return res.status(400).json({ error: "Business name is too long (255 characters max)." });
  }
  if (!Number.isInteger(unitCount) || unitCount < 0 || unitCount > 10000) {
    return res.status(400).json({ error: "Unit count must be a whole number from 0 to 10,000." });
  }

  await pool.query(
    `INSERT INTO owner_profiles (user_id, business_name, unit_count)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       business_name = EXCLUDED.business_name,
       unit_count = EXCLUDED.unit_count`,
    [req.user!.id, businessName, unitCount]
  );
  return res.json({ saved: true });
});

// DELETE /api/owner/extras/profile
ownerExtrasRouter.delete("/profile", async (req, res) => {
  await pool.query("DELETE FROM owner_profiles WHERE user_id = ?", [req.user!.id]);
  return res.json({ deleted: true });
});