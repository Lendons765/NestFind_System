import { Router } from "express";
import type { RowDataPacket } from "../db.js";
import { pool } from "../db.js";

export const listingMediaRouter = Router();

// GET /api/listings/:id/photos
// Public. Photos only (not walkthrough links), and only for active listings.
listingMediaRouter.get("/:id/photos", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.storage_url AS url
     FROM listing_media m
     JOIN listings l ON l.id = m.listing_id
     WHERE m.listing_id = ? AND m.media_type = 'photo' AND l.status = 'active'
     ORDER BY m.sort_order ASC`,
    [listingId]
  );
  res.json(rows);
});