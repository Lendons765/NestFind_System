import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const tenantRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every route here needs a logged-in tenant.
tenantRouter.use(requireAuth, requireRole("tenant"));

// GET /api/tenant/summary
// COUNT() returns text in PostgreSQL, so each count is cast to int.
tenantRouter.get("/summary", async (req, res) => {
  const id = req.user!.id;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*)::int FROM applications WHERE tenant_id = ?) AS applications,
       (SELECT COUNT(*)::int FROM applications WHERE tenant_id = ? AND status IN ('submitted', 'under_review')) AS pending_applications,
       (SELECT COUNT(*)::int FROM viewings WHERE tenant_id = ? AND status = 'requested') AS viewings_requested,
       (SELECT COUNT(*)::int FROM viewings WHERE tenant_id = ? AND status = 'confirmed') AS viewings_confirmed,
       (SELECT COUNT(*)::int FROM conversations WHERE tenant_id = ?) AS conversations,
       (SELECT COUNT(*)::int FROM leases WHERE tenant_id = ? AND status <> 'cancelled') AS leases`,
    [id, id, id, id, id, id]
  );
  return res.json(rows[0]);
});

// GET /api/tenant/conversations
// Every conversation this tenant started, with the owner's replies.
tenantRouter.get("/conversations", async (req, res) => {
  const id = req.user!.id;

  const [convs] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.listing_id, c.created_at, l.title AS listing_title,
            loc.barangay, o.full_name AS owner_name
     FROM conversations c
     JOIN listings l ON l.id = c.listing_id
     JOIN locations loc ON loc.id = l.location_id
     JOIN users o ON o.id = c.owner_id
     WHERE c.tenant_id = ?
     ORDER BY c.created_at DESC`,
    [id]
  );

  const [msgs] = await pool.query<RowDataPacket[]>(
    `SELECT m.conversation_id, m.body, m.created_at, m.sender_id, u.full_name AS sender_name
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     JOIN users u ON u.id = m.sender_id
     WHERE c.tenant_id = ?
     ORDER BY m.created_at ASC`,
    [id]
  );

  return res.json(
    convs.map((c) => ({
      id: c.id,
      listingId: c.listing_id,
      listingTitle: c.listing_title,
      barangay: c.barangay,
      ownerName: c.owner_name,
      createdAt: c.created_at,
      messages: msgs
        .filter((m) => m.conversation_id === c.id)
        .map((m) => ({
          body: m.body,
          sentAt: m.created_at,
          fromMe: m.sender_id === id,
          senderName: m.sender_name,
        })),
    }))
  );
});

// POST /api/tenant/conversations/:id/messages
// Body: { body }. The tenant can only write in their own conversations.
tenantRouter.post("/conversations/:id/messages", async (req, res) => {
  const conversationId = String(req.params.id ?? "");
  if (!UUID_RE.test(conversationId)) return res.status(404).json({ error: "Conversation not found." });

  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: "Write a message (up to 2000 characters)." });
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM conversations WHERE id = ? AND tenant_id = ?",
    [conversationId, req.user!.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Conversation not found." });

  const id = randomUUID();
  await pool.query(
    "INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)",
    [id, conversationId, req.user!.id, body]
  );
  return res.status(201).json({ id });
});

// GET /api/tenant/viewings
tenantRouter.get("/viewings", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.scheduled_at, v.status, v.notes, v.listing_id,
            l.title, loc.barangay
     FROM viewings v
     JOIN listings l ON l.id = v.listing_id
     JOIN locations loc ON loc.id = l.location_id
     WHERE v.tenant_id = ?
     ORDER BY v.scheduled_at ASC`,
    [req.user!.id]
  );
  return res.json(rows);
});

// POST /api/tenant/listings/:listingId/viewings
// Body: { scheduledAt, notes? }. Books a viewing and opens a conversation with the owner.
tenantRouter.post("/listings/:listingId/viewings", async (req, res) => {
  const listingId = String(req.params.listingId ?? "");
  if (!UUID_RE.test(listingId)) return res.status(404).json({ error: "This listing isn't available to book." });

  const scheduledAt = typeof req.body?.scheduledAt === "string" ? new Date(req.body.scheduledAt) : null;
  const notes =
    typeof req.body?.notes === "string" && req.body.notes.trim() ? req.body.notes.trim().slice(0, 1000) : null;

  if (!scheduledAt || isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ error: "Choose a valid date and time." });
  }
  if (scheduledAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Choose a time in the future." });
  }

  const [listings] = await pool.query<RowDataPacket[]>(
    "SELECT id, owner_id FROM listings WHERE id = ? AND status = 'active'",
    [listingId]
  );
  const listing = listings[0];
  if (!listing) {
    return res.status(404).json({ error: "This listing isn't available to book." });
  }

  const [upcoming] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM viewings
     WHERE listing_id = ? AND tenant_id = ? AND status IN ('requested', 'confirmed') AND scheduled_at > NOW()
     LIMIT 1`,
    [listing.id, req.user!.id]
  );
  if (upcoming.length > 0) {
    return res.status(409).json({ error: "You already have an upcoming viewing for this place." });
  }

  // Makes sure the owner's inbox shows this booking, even without a prior inquiry.
  // The unique (listing_id, tenant_id) constraint makes this a no-op when the conversation exists.
  await pool.query(
    `INSERT INTO conversations (id, listing_id, tenant_id, owner_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (listing_id, tenant_id) DO NOTHING`,
    [randomUUID(), listing.id, req.user!.id, listing.owner_id]
  );

  const id = randomUUID();
  await pool.query(
    `INSERT INTO viewings (id, listing_id, tenant_id, scheduled_at, status, notes)
     VALUES (?, ?, ?, ?, 'requested', ?)`,
    [id, listing.id, req.user!.id, scheduledAt, notes]
  );
  return res.status(201).json({ id, status: "requested" });
});

// PATCH /api/tenant/viewings/:id/cancel
tenantRouter.patch("/viewings/:id/cancel", async (req, res) => {
  const viewingId = String(req.params.id ?? "");
  if (!UUID_RE.test(viewingId)) return res.status(404).json({ error: "Viewing not found." });

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, status FROM viewings WHERE id = ? AND tenant_id = ?",
    [viewingId, req.user!.id]
  );
  const viewing = rows[0];
  if (!viewing) return res.status(404).json({ error: "Viewing not found." });
  if (viewing.status !== "requested" && viewing.status !== "confirmed") {
    return res.status(409).json({ error: "This viewing can't be cancelled." });
  }

  await pool.query("UPDATE viewings SET status = 'cancelled' WHERE id = ?", [viewing.id]);
  return res.json({ id: viewing.id, status: "cancelled" });
});