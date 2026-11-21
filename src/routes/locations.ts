import { Router } from "express";
import type { RowDataPacket } from "../db.js";
import { pool } from "../db.js";

export const locationsRouter = Router();

// GET /api/locations
// Public. Fills the location dropdown when an owner creates a listing.
locationsRouter.get("/", async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, city, barangay FROM locations ORDER BY city, barangay"
  );
  res.json(rows);
});