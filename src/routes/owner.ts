import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { requireAuth, requireRole } from "../auth";

export const ownerRouter = Router();

// Every route in this file needs a logged-in owner.
ownerRouter.use(requireAuth, requireRole("owner"));

// GET /api/owner/inquiries
// Conversations on this owner's listings, with their messages and viewing requests.
ownerRouter.get("/inquiries", async (req, res) => {
  const ownerId = req.user!.id;

  const [conversations] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.listing_id, c.tenant_id, c.created_at,
            l.title AS listing_title,
            t.full_name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone
     FROM conversations c
     JOIN listings l ON l.id = c.listing_id
     JOIN users t ON t.id = c.tenant_id
     WHERE c.owner_id = ?
     ORDER BY c.created_at DESC`,
    [ownerId]
  );

  const [messages] = await pool.query<RowDataPacket[]>(
    `SELECT m.conversation_id, m.body, m.created_at, u.full_name AS sender_name
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     JOIN users u ON u.id = m.sender_id
     WHERE c.owner_id = ?
     ORDER BY m.created_at ASC`,
    [ownerId]
  );

  const [viewings] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.listing_id, v.tenant_id, v.scheduled_at, v.status, v.notes
     FROM viewings v
     JOIN listings l ON l.id = v.listing_id
     WHERE l.owner_id = ?
     ORDER BY v.scheduled_at ASC`,
    [ownerId]
  );

  const result = conversations.map((c) => ({
    conversationId: c.id,
    listingId: c.listing_id,
    listingTitle: c.listing_title,
    tenant: {
      id: c.tenant_id,
      name: c.tenant_name,
      email: c.tenant_email,
      phone: c.tenant_phone,
    },
    createdAt: c.created_at,
    messages: messages
      .filter((m) => m.conversation_id === c.id)
      .map((m) => ({ body: m.body, sentAt: m.created_at, senderName: m.sender_name })),
    viewings: viewings
      .filter((v) => v.listing_id === c.listing_id && v.tenant_id === c.tenant_id)
      .map((v) => ({
        id: v.id,
        scheduledAt: v.scheduled_at,
        status: v.status,
        notes: v.notes,
      })),
  }));

  return res.json(result);
});

// PATCH /api/owner/viewings/:id
// Body: { status: "confirmed" | "cancelled" }
// Only requests on this owner's listings can be changed, and only while they're pending.
ownerRouter.patch("/viewings/:id", async (req, res) => {
  const status = req.body?.status;
  if (status !== "confirmed" && status !== "cancelled") {
    return res.status(400).json({ error: "Status must be confirmed or cancelled." });
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.status
     FROM viewings v
     JOIN listings l ON l.id = v.listing_id
     WHERE v.id = ? AND l.owner_id = ?`,
    [req.params.id, req.user!.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Viewing request not found." });
  }
  if (rows[0].status !== "requested") {
    return res.status(409).json({ error: `This request is already ${rows[0].status}.` });
  }

  await pool.query("UPDATE viewings SET status = ? WHERE id = ?", [status, req.params.id]);
  return res.json({ id: req.params.id, status });
});

// GET /api/owner/listings
// All of this owner's listings, including drafts, pending ones, and rejections.
ownerRouter.get("/listings", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.monthly_rent, l.status, l.verification, l.rejection_reason,
            l.published_at, loc.barangay,
            (SELECT COUNT(*) FROM listing_media m WHERE m.listing_id = l.id) AS photo_count
     FROM listings l
     JOIN locations loc ON loc.id = l.location_id
     WHERE l.owner_id = ?
     ORDER BY l.created_at DESC`,
    [req.user!.id]
  );
  return res.json(rows);
});

// POST /api/owner/listings/:id/submit
// Moves a draft to pending_verification so an admin can review it.
ownerRouter.post("/listings/:id/submit", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM listings WHERE id = ? AND owner_id = ?",
    [req.params.id, req.user!.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Listing not found." });
  }
  if (rows[0].status !== "draft") {
    return res.status(409).json({ error: `This listing is already ${rows[0].status}.` });
  }

  await pool.query(
    "UPDATE listings SET status = 'pending_verification' WHERE id = ?",
    [req.params.id]
  );
  return res.json({ id: req.params.id, status: "pending_verification" });
});