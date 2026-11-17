import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

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
  const viewingId = String(req.params.id ?? "");
  const status = req.body?.status;
  if (status !== "confirmed" && status !== "cancelled") {
    return res.status(400).json({ error: "Status must be confirmed or cancelled." });
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.status
     FROM viewings v
     JOIN listings l ON l.id = v.listing_id
     WHERE v.id = ? AND l.owner_id = ?`,
    [viewingId, req.user!.id]
  );
  const viewing = rows[0];
  if (!viewing) {
    return res.status(404).json({ error: "Viewing request not found." });
  }
  if (viewing.status !== "requested") {
    return res.status(409).json({ error: `This request is already ${viewing.status}.` });
  }

  await pool.query("UPDATE viewings SET status = ? WHERE id = ?", [status, viewingId]);
  return res.json({ id: viewingId, status });
});

// GET /api/owner/listings
// All of this owner's listings, with views, inquiries, and applicants.
ownerRouter.get("/listings", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.monthly_rent, l.status, l.verification, l.rejection_reason,
            l.published_at, l.view_count, loc.barangay,
            (SELECT COUNT(*) FROM listing_media m
               WHERE m.listing_id = l.id AND m.media_type = 'photo') AS photo_count,
            (SELECT COUNT(*) FROM conversations c WHERE c.listing_id = l.id) AS inquiry_count,
            (SELECT COUNT(*) FROM applications a WHERE a.listing_id = l.id) AS applicant_count,
            (SELECT COUNT(*) FROM applications a
               WHERE a.listing_id = l.id AND a.status = 'submitted') AS new_applicant_count
     FROM listings l
     JOIN locations loc ON loc.id = l.location_id
     WHERE l.owner_id = ?
     ORDER BY l.created_at DESC`,
    [req.user!.id]
  );
  return res.json(rows);
});

// POST /api/owner/listings/:id/submit
// Publishes a draft so it appears in search immediately.
ownerRouter.post("/listings/:id/submit", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM listings WHERE id = ? AND owner_id = ?",
    [listingId, req.user!.id]
  );
  const listing = rows[0];
  if (!listing) {
    return res.status(404).json({ error: "Listing not found." });
  }
  if (listing.status !== "draft") {
    return res.status(409).json({ error: `This listing is already ${listing.status}.` });
  }

  await pool.query(
    "UPDATE listings SET status = 'active', published_at = NOW(3) WHERE id = ?",
    [listingId]
  );
  return res.json({ id: listingId, status: "active" });
});