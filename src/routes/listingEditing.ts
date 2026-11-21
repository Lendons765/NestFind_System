import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import type { RowDataPacket } from "../db.js";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const listingEditingRouter = Router();

// Every route here needs a logged-in owner.
listingEditingRouter.use(requireAuth, requireRole("owner"));

const PROPERTY_TYPES = ["boarding_house", "studio", "apartment", "condo", "house", "other"];
const MAX_PHOTOS = 10;
const UPLOAD_DIR = path.resolve("uploads");
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, randomUUID() + (EXTENSIONS[file.mimetype] ?? "")),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in EXTENSIONS),
});

function uploadOne(req: Request, res: Response, next: NextFunction) {
  upload.single("photo")(req, res, (err: unknown) => {
    if (err) {
      return res.status(400).json({ error: "Photo must be a JPG, PNG, or WebP under 5 MB." });
    }
    next();
  });
}

// Returns the listing only if this owner owns it.
async function ownListing(listingId: string, ownerId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM listings WHERE id = ? AND owner_id = ?",
    [listingId, ownerId]
  );
  return rows[0] ?? null;
}

function parseListing(body: any) {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const propertyType = typeof body.propertyType === "string" ? body.propertyType : "";
  const locationId = Number(body.locationId);
  const monthlyRent = Number(body.monthlyRent);
  const bedrooms =
    body.bedrooms === undefined || body.bedrooms === null || body.bedrooms === "" ? null : Number(body.bedrooms);

  if (!title || title.length > 255) return { error: "Title is required (up to 255 characters)." };
  if (!PROPERTY_TYPES.includes(propertyType)) return { error: "Property type is invalid." };
  if (!Number.isInteger(locationId) || locationId <= 0) return { error: "Location is required." };
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0 || monthlyRent > 10_000_000) {
    return { error: "Monthly rent must be a positive amount." };
  }
  if (bedrooms !== null && (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20)) {
    return { error: "Bedrooms must be between 0 and 20." };
  }

  return {
    data: {
      title,
      propertyType,
      locationId,
      monthlyRent,
      bedrooms,
      description: str(body.description),
      addressLine: str(body.addressLine),
      houseRules: str(body.houseRules),
      isFurnished: !!body.isFurnished,
      hasAircon: !!body.hasAircon,
      hasWifi: !!body.hasWifi,
      hasParking: !!body.hasParking,
      hasGym: !!body.hasGym,
    },
  };
}

// GET /api/owner/listings/:id
listingEditingRouter.get("/:id", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const listing = await ownListing(listingId, req.user!.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });

  const [photos] = await pool.query<RowDataPacket[]>(
    "SELECT id, storage_url AS url FROM listing_media WHERE listing_id = ? AND media_type = 'photo' ORDER BY sort_order",
    [listing.id]
  );
  return res.json({ ...listing, photos });
});

// PATCH /api/owner/listings/:id
// Only drafts can change.
listingEditingRouter.patch("/:id", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const listing = await ownListing(listingId, req.user!.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (listing.status !== "draft") {
    return res.status(409).json({
      error: "Only drafts can be edited. Listings waiting for review or live cannot be changed.",
    });
  }

  const parsed = parseListing(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const d = parsed.data;

  const [locations] = await pool.query<RowDataPacket[]>("SELECT id FROM locations WHERE id = ?", [d.locationId]);
  if (!locations[0]) return res.status(400).json({ error: "Location not found." });

  await pool.query(
    `UPDATE listings SET title = ?, description = ?, property_type = ?, address_line = ?,
       monthly_rent = ?, bedrooms = ?, is_furnished = ?, has_aircon = ?, has_wifi = ?,
       has_parking = ?, has_gym = ?, house_rules = ?, location_id = ?
     WHERE id = ?`,
    [
      d.title,
      d.description,
      d.propertyType,
      d.addressLine,
      d.monthlyRent,
      d.bedrooms,
      +d.isFurnished,
      +d.hasAircon,
      +d.hasWifi,
      +d.hasParking,
      +d.hasGym,
      d.houseRules,
      d.locationId,
      listing.id,
    ]
  );
  return res.json({ id: listing.id, status: "draft" });
});

// DELETE /api/owner/listings/:id
// Only drafts can be deleted.
listingEditingRouter.delete("/:id", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const listing = await ownListing(listingId, req.user!.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (listing.status !== "draft") {
    return res.status(409).json({ error: "Only drafts can be deleted." });
  }

  const [photos] = await pool.query<RowDataPacket[]>(
    "SELECT storage_url FROM listing_media WHERE listing_id = ?",
    [listing.id]
  );

  await pool.query("DELETE FROM listings WHERE id = ?", [listing.id]);

  for (const photo of photos) {
    await unlink(path.join(UPLOAD_DIR, path.basename(photo.storage_url))).catch(() => {});
  }

  return res.json({ deleted: true });
});

// POST /api/owner/listings/:id/photos
// Form field "photo". Up to 10 photos per listing.
listingEditingRouter.post("/:id/photos", uploadOne, async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const discardFile = async () => {
    if (req.file) await unlink(req.file.path).catch(() => {});
  };

  const listing = await ownListing(listingId, req.user!.id);
  if (!listing) {
    await discardFile();
    return res.status(404).json({ error: "Listing not found." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Choose a JPG, PNG, or WebP image." });
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*)::int AS n FROM listing_media WHERE listing_id = ? AND media_type = 'photo'",
    [listing.id]
  );
  const count = Number(countRows[0]?.n ?? 0);
  if (count >= MAX_PHOTOS) {
    await discardFile();
    return res.status(409).json({ error: `A listing can have up to ${MAX_PHOTOS} photos.` });
  }

  const photoId = randomUUID();
  const url = `/uploads/${req.file.filename}`;
  await pool.query(
    `INSERT INTO listing_media (id, listing_id, media_type, storage_url, sort_order)
     VALUES (?, ?, 'photo', ?, ?)`,
    [photoId, listing.id, url, count]
  );
  return res.status(201).json({ id: photoId, url });
});

// DELETE /api/owner/listings/:id/photos/:photoId
listingEditingRouter.delete("/:id/photos/:photoId", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const photoId = String(req.params.photoId ?? "");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.storage_url FROM listing_media m
     JOIN listings l ON l.id = m.listing_id
     WHERE m.id = ? AND m.listing_id = ? AND l.owner_id = ?`,
    [photoId, listingId, req.user!.id]
  );
  const photo = rows[0];
  if (!photo) return res.status(404).json({ error: "Photo not found." });

  await pool.query("DELETE FROM listing_media WHERE id = ?", [photo.id]);
  await unlink(path.join(UPLOAD_DIR, path.basename(photo.storage_url))).catch(() => {});
  return res.json({ deleted: true });
});

// POST /api/owner/listings/:id/walkthrough
// Body: { url }. One walkthrough per listing; saving again replaces it.
listingEditingRouter.post("/:id/walkthrough", async (req, res) => {
  const listingId = String(req.params.id ?? "");
  const listing = await ownListing(listingId, req.user!.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });

  const raw = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return res.status(400).json({ error: "Enter a full link starting with https://" });
  }
  if (parsed.protocol !== "https:" || raw.length > 500) {
    return res.status(400).json({ error: "The walkthrough link must start with https:// (max 500 characters)." });
  }

  await pool.query("DELETE FROM listing_media WHERE listing_id = ? AND media_type = 'tour_360'", [listing.id]);
  await pool.query(
    `INSERT INTO listing_media (id, listing_id, media_type, storage_url, sort_order)
     VALUES (?, ?, 'tour_360', ?, 0)`,
    [randomUUID(), listing.id, raw]
  );
  return res.status(201).json({ url: raw });
});