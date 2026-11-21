import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const listingsRouter = Router();

const PROPERTY_TYPES = ["boarding_house", "studio", "apartment", "condo", "house", "other"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Maps are used instead of plain objects so a query like "constructor" can't match.
const AMENITY_COLUMNS = new Map<string, string>([
  ["aircon", "l.has_aircon"],
  ["wifi", "l.has_wifi"],
  ["furnished", "l.is_furnished"],
  ["parking", "l.has_parking"],
]);

// NULLS LAST keeps unpublished listings at the end, matching MySQL's default.
const SORT_ORDERS = new Map<string, string>([
  ["rent_asc", "l.monthly_rent ASC"],
  ["rent_desc", "l.monthly_rent DESC"],
  ["newest", "l.published_at DESC NULLS LAST"],
  ["featured", "l.is_featured DESC, l.monthly_rent ASC"],
]);

// GET /api/listings?q=Lahug&barangay=Lahug&propertyType=studio&maxRent=10000
//   &bedrooms=studio|0|1|2|3+&amenities=aircon,wifi&sort=rent_asc
listingsRouter.get("/", async (req, res) => {
  const { q, barangay, propertyType, maxRent, bedrooms, sort, amenities } = req.query;

  let sql = `
    SELECT l.id, l.title, loc.city, loc.barangay, l.property_type, l.monthly_rent,
           l.bedrooms, l.has_aircon, l.has_wifi, l.has_parking, l.is_furnished,
           l.is_featured, l.verification,
           (SELECT m.storage_url FROM listing_media m
              WHERE m.listing_id = l.id
              ORDER BY m.sort_order ASC LIMIT 1) AS cover_url
    FROM listings l
    JOIN locations loc ON loc.id = l.location_id
    WHERE l.status = 'active'`;
  const params: unknown[] = [];

  // Free-text search from the homepage: matches city, barangay, or title.
  if (typeof q === "string" && q.trim()) {
    sql += " AND (loc.city ILIKE ? OR loc.barangay ILIKE ? OR l.title ILIKE ?)";
    const like = `%${q.trim()}%`;
    params.push(like, like, like);
  }
  if (typeof barangay === "string" && barangay) {
    sql += " AND loc.barangay = ?";
    params.push(barangay);
  }
  if (typeof propertyType === "string" && PROPERTY_TYPES.includes(propertyType)) {
    sql += " AND l.property_type = ?";
    params.push(propertyType);
  }
  if (typeof maxRent === "string" && maxRent && Number.isFinite(Number(maxRent))) {
    sql += " AND l.monthly_rent <= ?";
    params.push(Number(maxRent));
  }

  if (bedrooms === "studio") {
    sql += " AND l.bedrooms = 0";
  } else if (bedrooms === "3+") {
    sql += " AND l.bedrooms >= 3";
  } else if (typeof bedrooms === "string" && /^[0-2]$/.test(bedrooms)) {
    sql += " AND l.bedrooms = ?";
    params.push(Number(bedrooms));
  }

  if (typeof amenities === "string") {
    for (const key of amenities.split(",")) {
      const column = AMENITY_COLUMNS.get(key);
      if (column) sql += ` AND ${column} = 1`;
    }
  }

  const order = SORT_ORDERS.get(typeof sort === "string" ? sort : "") ?? SORT_ORDERS.get("featured")!;
  sql += ` ORDER BY ${order} LIMIT 50`;

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

// GET /api/listings/:id (the address is never returned here)
listingsRouter.get("/:id", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  if (!UUID_RE.test(listingId)) return res.status(404).json({ error: "Not found" });

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.description, loc.city, loc.barangay, l.property_type,
            l.monthly_rent, l.bedrooms, l.is_furnished, l.has_aircon, l.has_wifi,
            l.has_parking, l.has_gym, l.house_rules, l.verification, l.view_count
     FROM listings l
     JOIN locations loc ON loc.id = l.location_id
     WHERE l.id = ? AND l.status = 'active'`,
    [listingId]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  await pool.query("UPDATE listings SET view_count = view_count + 1 WHERE id = ?", [listingId]);

  const [tours] = await pool.query<RowDataPacket[]>(
    "SELECT storage_url FROM listing_media WHERE listing_id = ? AND media_type = 'tour_360' LIMIT 1",
    [listingId]
  );

  res.json({ ...rows[0], walkthroughUrl: tours[0]?.storage_url ?? null });
});

// GET /api/listings/:id/address
// Visible to the listing's owner, and to a tenant with a confirmed viewing.
listingsRouter.get("/:id/address", requireAuth, async (req, res) => {
  const listingId = String(req.params.id ?? "");
  if (!UUID_RE.test(listingId)) return res.status(404).json({ error: "Listing not found." });
  const userId = req.user!.id;

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT owner_id, address_line FROM listings WHERE id = ?",
    [listingId]
  );
  const listing = rows[0];
  if (!listing) {
    return res.status(404).json({ error: "Listing not found." });
  }
  let allowed = listing.owner_id === userId;

  if (!allowed && req.user!.role === "tenant") {
    const [viewings] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM viewings
       WHERE listing_id = ? AND tenant_id = ? AND status = 'confirmed'
       LIMIT 1`,
      [listingId, userId]
    );
    allowed = viewings.length > 0;
  }

  if (!allowed) {
    return res.status(403).json({
      error: "The address is shared once your viewing is confirmed.",
    });
  }

  return res.json({ addressLine: listing.address_line });
});

// POST /api/listings
// Owners only. The owner comes from the login token, not the request body.
// New listings start as draft and stay hidden until published.
listingsRouter.post("/", requireAuth, requireRole("owner"), async (req, res) => {
  const body = req.body ?? {};

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" && body.description.trim()
    ? body.description.trim()
    : null;
  const propertyType = typeof body.propertyType === "string" ? body.propertyType : "";
  const locationId = Number(body.locationId);
  const monthlyRent = Number(body.monthlyRent);
  const addressLine = typeof body.addressLine === "string" && body.addressLine.trim()
    ? body.addressLine.trim()
    : null;
  const bedrooms = body.bedrooms === undefined || body.bedrooms === null || body.bedrooms === ""
    ? null
    : Number(body.bedrooms);
  const houseRules = typeof body.houseRules === "string" && body.houseRules.trim()
    ? body.houseRules.trim()
    : null;

  if (!title || title.length > 255) {
    return res.status(400).json({ error: "Title is required (up to 255 characters)." });
  }
  if (!PROPERTY_TYPES.includes(propertyType)) {
    return res.status(400).json({ error: "Property type is invalid." });
  }
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return res.status(400).json({ error: "Location is required." });
  }
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0 || monthlyRent > 10_000_000) {
    return res.status(400).json({ error: "Monthly rent must be a positive amount." });
  }
  if (bedrooms !== null && (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20)) {
    return res.status(400).json({ error: "Bedrooms must be between 0 and 20." });
  }

  const [locations] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM locations WHERE id = ?",
    [locationId]
  );
  if (locations.length === 0) {
    return res.status(400).json({ error: "Location not found." });
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO listings
       (id, owner_id, location_id, title, description, property_type, address_line,
        monthly_rent, bedrooms, is_furnished, has_aircon, has_wifi, has_parking, has_gym,
        house_rules, status, verification)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'unverified')`,
    [
      id,
      req.user!.id,
      locationId,
      title,
      description,
      propertyType,
      addressLine,
      monthlyRent,
      bedrooms,
      body.isFurnished ? 1 : 0,
      body.hasAircon ? 1 : 0,
      body.hasWifi ? 1 : 0,
      body.hasParking ? 1 : 0,
      body.hasGym ? 1 : 0,
      houseRules,
    ]
  );

  return res.status(201).json({ id, status: "draft" });
});