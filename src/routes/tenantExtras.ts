import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const tenantExtrasRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

tenantExtrasRouter.use(requireAuth, requireRole("tenant"));

// GET /api/tenant/saved
tenantExtrasRouter.get("/saved", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.monthly_rent, l.property_type, loc.barangay,
            (SELECT m.storage_url FROM listing_media m
               WHERE m.listing_id = l.id AND m.media_type = 'photo'
               ORDER BY m.sort_order LIMIT 1) AS cover_url,
            s.created_at AS saved_at
     FROM saved_listings s
     JOIN listings l ON l.id = s.listing_id
     JOIN locations loc ON loc.id = l.location_id
     WHERE s.user_id = ? AND l.status = 'active'
     ORDER BY s.created_at DESC`,
    [req.user!.id]
  );
  return res.json(rows);
});

// GET /api/tenant/saved/ids
// Lightweight list of saved IDs, used to fill hearts on listing pages.
tenantExtrasRouter.get("/saved/ids", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT listing_id FROM saved_listings WHERE user_id = ?",
    [req.user!.id]
  );
  return res.json(rows.map((r) => r.listing_id));
});

// PUT /api/tenant/saved/:listingId
tenantExtrasRouter.put("/saved/:listingId", async (req, res) => {
  const listingId = String(req.params.listingId ?? "");
  if (!UUID_RE.test(listingId)) return res.status(404).json({ error: "Listing not found." });

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM listings WHERE id = ? AND status = 'active'",
    [listingId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Listing not found." });

  await pool.query(
    `INSERT INTO saved_listings (user_id, listing_id)
     VALUES (?, ?)
     ON CONFLICT (user_id, listing_id) DO NOTHING`,
    [req.user!.id, listingId]
  );
  return res.json({ saved: true });
});

// DELETE /api/tenant/saved/:listingId
tenantExtrasRouter.delete("/saved/:listingId", async (req, res) => {
  const listingId = String(req.params.listingId ?? "");
  if (!UUID_RE.test(listingId)) return res.json({ saved: false });

  await pool.query(
    "DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?",
    [req.user!.id, listingId]
  );
  return res.json({ saved: false });
});

// PATCH /api/tenant/applications/:id/withdraw
// Only applications still waiting for the owner can be withdrawn.
tenantExtrasRouter.patch("/applications/:id/withdraw", async (req, res) => {
  const applicationId = String(req.params.id ?? "");
  if (!UUID_RE.test(applicationId)) return res.status(404).json({ error: "Application not found." });

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, status FROM applications WHERE id = ? AND tenant_id = ?",
    [applicationId, req.user!.id]
  );
  const app = rows[0];
  if (!app) return res.status(404).json({ error: "Application not found." });
  if (app.status !== "submitted" && app.status !== "under_review") {
    return res.status(409).json({ error: "Only applications waiting for the owner can be withdrawn." });
  }

  await pool.query("UPDATE applications SET status = 'withdrawn' WHERE id = ?", [app.id]);
  return res.json({ id: app.id, status: "withdrawn" });
});

// GET /api/tenant/activity
// Recent events across messages, viewings, applications, and leases.
tenantExtrasRouter.get("/activity", async (req, res) => {
  const id = req.user!.id;
  const [rows] = await pool.query<RowDataPacket[]>(
    `(SELECT 'message' AS kind, m.created_at AS at,
             (u.full_name || ' sent a message about ' || l.title) AS text
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN listings l ON l.id = c.listing_id
      JOIN users u ON u.id = m.sender_id
      WHERE c.tenant_id = ? AND m.sender_id <> ?)
     UNION ALL
     (SELECT 'viewing' AS kind, v.updated_at AS at,
             ('Viewing for ' || l.title || ' is ' || v.status::text) AS text
      FROM viewings v JOIN listings l ON l.id = v.listing_id
      WHERE v.tenant_id = ?)
     UNION ALL
     (SELECT 'application' AS kind, a.updated_at AS at,
             ('Application for ' || l.title || ' is ' || a.status::text) AS text
      FROM applications a JOIN listings l ON l.id = a.listing_id
      WHERE a.tenant_id = ?)
     UNION ALL
     (SELECT 'lease' AS kind, le.updated_at AS at,
             ('Lease for ' || l.title || ' is ' || le.status::text) AS text
      FROM leases le JOIN listings l ON l.id = le.listing_id
      WHERE le.tenant_id = ?)
     ORDER BY at DESC
     LIMIT 15`,
    [id, id, id, id, id]
  );
  return res.json(rows);
});

// ---------- Own profile ----------

// GET /api/tenant/account
tenantExtrasRouter.get("/account", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, full_name, email, phone, created_at FROM users WHERE id = ? AND role = 'tenant'",
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

// PUT /api/tenant/account
// Body: { fullName, phone? }. Email and password are changed through their own verified flows.
tenantExtrasRouter.put("/account", async (req, res) => {
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
      "UPDATE users SET full_name = ?, phone = ? WHERE id = ? AND role = 'tenant'",
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