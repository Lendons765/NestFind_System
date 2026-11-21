import { Router } from "express";
import { pool } from "../db.js";

// Mounted at /api/listings/:id/inquiries
export const inquiriesRouter = Router({ mergeParams: true });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/listings/:id/inquiries
// Body: { name, email, phone?, message, preferredAt? }
inquiriesRouter.post("/", async (req, res) => {
  const id = String((req.params as Record<string, string | undefined>).id ?? "");
  const body = req.body ?? {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const preferredAt = body.preferredAt ? new Date(String(body.preferredAt)) : null;

  if (!name || name.length > 255) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  if (phone && phone.length > 32) {
    return res.status(400).json({ error: "Phone number is too long." });
  }
  if (!message || message.length > 2000) {
    return res.status(400).json({ error: "Message is required (up to 2000 characters)." });
  }
  if (preferredAt && isNaN(preferredAt.getTime())) {
    return res.status(400).json({ error: "Preferred date is invalid." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. The listing must exist and be active.
    const [listingRows] = await conn.query<any[]>(
      "SELECT owner_id FROM listings WHERE id = ? AND status = 'active'",
      [id]
    );
    if (listingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Listing not found." });
    }
    const ownerId: string = listingRows[0].owner_id;

    // 2. Create the tenant, or update the existing user with this email.
    await conn.query(
      `INSERT INTO users (id, role, full_name, email, phone)
       VALUES (gen_random_uuid(), 'tenant', ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = COALESCE(EXCLUDED.phone, users.phone)`,
      [name, email, phone]
    );
    const [userRows] = await conn.query<any[]>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    const tenantId: string = userRows[0].id;

    if (tenantId === ownerId) {
      await conn.rollback();
      return res.status(400).json({ error: "You can't send an inquiry about your own listing." });
    }

    // 3. One conversation per listing and tenant.
    await conn.query(
      `INSERT INTO conversations (id, listing_id, tenant_id, owner_id)
       VALUES (gen_random_uuid(), ?, ?, ?)
       ON CONFLICT (listing_id, tenant_id) DO NOTHING`,
      [id, tenantId, ownerId]
    );
    const [convRows] = await conn.query<any[]>(
      "SELECT id FROM conversations WHERE listing_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    const conversationId: string = convRows[0].id;

    // 4. Store the message.
    await conn.query(
      "INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (gen_random_uuid(), ?, ?, ?)",
      [conversationId, tenantId, message]
    );

    // 5. Optional viewing request.
    if (preferredAt) {
      await conn.query(
        `INSERT INTO viewings (id, listing_id, tenant_id, scheduled_at, status, notes)
         VALUES (gen_random_uuid(), ?, ?, ?, 'requested', ?)`,
        [id, tenantId, preferredAt, message]
      );
    }

    await conn.commit();
    return res.status(201).json({
      conversationId,
      status: "sent",
      viewingRequested: preferredAt !== null,
    });
  } catch (err) {
    await conn.rollback();
    console.error("Inquiry failed:", err);
    return res.status(500).json({ error: "Could not send your inquiry. Please try again." });
  } finally {
    conn.release();
  }
});