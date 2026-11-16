import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { requireAuth, requireRole } from "../auth";

export const adminRouter = Router();

// Every route in this file needs a logged-in admin.
adminRouter.use(requireAuth, requireRole("admin"));

// GET /api/admin/listings?status=pending_verification
adminRouter.get("/listings", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "pending_verification";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.monthly_rent, l.status, l.created_at,
            loc.barangay, u.full_name AS owner_name, u.email AS owner_email
     FROM listings l
     JOIN locations loc ON loc.id = l.location_id
     JOIN users u ON u.id = l.owner_id
     WHERE l.status = ?
     ORDER BY l.created_at ASC`,
    [status]
  );
  return res.json(rows);
});

// POST /api/admin/listings/:id/approve
adminRouter.post("/listings/:id/approve", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM listings WHERE id = ?",
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Listing not found." });
  }
  if (rows[0].status !== "pending_verification") {
    return res.status(409).json({ error: `Only pending listings can be approved (this one is ${rows[0].status}).` });
  }

  await pool.query(
    `UPDATE listings
     SET status = 'active', verification = 'verified', published_at = NOW(3), rejection_reason = NULL
     WHERE id = ?`,
    [req.params.id]
  );
  return res.json({ id: req.params.id, status: "active" });
});

// POST /api/admin/listings/:id/reject
// Body: { reason }. The reason is shown to the owner.
adminRouter.post("/listings/:id/reject", async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    return res.status(400).json({ error: "Tell the owner what to change." });
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM listings WHERE id = ?",
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Listing not found." });
  }
  if (rows[0].status !== "pending_verification") {
    return res.status(409).json({ error: `Only pending listings can be sent back (this one is ${rows[0].status}).` });
  }

  await pool.query(
    "UPDATE listings SET status = 'draft', verification = 'rejected', rejection_reason = ? WHERE id = ?",
    [reason.slice(0, 500), req.params.id]
  );
  return res.json({ id: req.params.id, status: "draft" });
});