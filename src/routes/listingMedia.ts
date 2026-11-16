import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";

export const listingMediaRouter = Router();

// GET /api/listings/:id/photos
// Public. Returns photos only for active listings.
listingMediaRouter.get("/:id/photos", async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.storage_url AS url
     FROM listing_media m
     JOIN listings l ON l.id = m.listing_id
     WHERE m.listing_id = ? AND l.status = 'active'
     ORDER BY m.sort_order ASC`,
    [req.params.id]
  );
  res.json(rows);
});