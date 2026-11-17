import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const leasingRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 10_000_000;
const APPLICANT_STATUSES = ["under_review", "approved", "rejected"];

// Loads an application with the listing owner and the listing's rent.
async function loadApplication(applicationId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.listing_id, a.tenant_id, a.status, l.owner_id, l.monthly_rent
     FROM applications a
     JOIN listings l ON l.id = a.listing_id
     WHERE a.id = ?`,
    [applicationId]
  );
  return rows[0] ?? null;
}

async function leaseExistsFor(applicationId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM leases WHERE application_id = ?",
    [applicationId]
  );
  return rows.length > 0;
}

// POST /api/listings/:listingId/applications (tenant)
leasingRouter.post("/listings/:listingId/applications", requireAuth, requireRole("tenant"), async (req, res) => {
  const listingId = String(req.params.listingId ?? "");
  const body = req.body ?? {};
  const desiredMoveIn = typeof body.desiredMoveIn === "string" && body.desiredMoveIn ? body.desiredMoveIn : null;
  const term =
    body.leaseTermMonths === undefined || body.leaseTermMonths === "" ? null : Number(body.leaseTermMonths);

  if (desiredMoveIn && !DATE_RE.test(desiredMoveIn)) {
    return res.status(400).json({ error: "Choose a valid move-in date." });
  }
  if (term !== null && (!Number.isInteger(term) || term < 1 || term > 24)) {
    return res.status(400).json({ error: "Lease term must be 1 to 24 months." });
  }

  const [listings] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM listings WHERE id = ? AND status = 'active'",
    [listingId]
  );
  if (listings.length === 0) {
    return res.status(404).json({ error: "This listing isn't accepting applications." });
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM applications WHERE listing_id = ? AND tenant_id = ?",
    [listingId, req.user!.id]
  );
  if (existing.length > 0) {
    return res.status(409).json({ error: "You have already applied for this listing." });
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO applications (id, listing_id, tenant_id, status, desired_move_in, lease_term_months)
     VALUES (?, ?, ?, 'submitted', ?, ?)`,
    [id, listingId, req.user!.id, desiredMoveIn, term]
  );
  return res.status(201).json({ id, status: "submitted" });
});

// GET /api/applications/mine (tenant)
leasingRouter.get("/applications/mine", requireAuth, requireRole("tenant"), async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.status, a.desired_move_in, a.lease_term_months, a.created_at,
            l.id AS listing_id, l.title, loc.barangay,
            (SELECT le.id FROM leases le WHERE le.application_id = a.id) AS lease_id
     FROM applications a
     JOIN listings l ON l.id = a.listing_id
     JOIN locations loc ON loc.id = l.location_id
     WHERE a.tenant_id = ?
     ORDER BY a.created_at DESC`,
    [req.user!.id]
  );
  return res.json(rows);
});

// GET /api/listings/:listingId/applications (owner of that listing)
leasingRouter.get("/listings/:listingId/applications", requireAuth, requireRole("owner"), async (req, res) => {
  const listingId = String(req.params.listingId ?? "");
  const [owned] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM listings WHERE id = ? AND owner_id = ?",
    [listingId, req.user!.id]
  );
  if (owned.length === 0) return res.status(404).json({ error: "Listing not found." });

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.status, a.desired_move_in, a.lease_term_months, a.created_at,
            u.full_name AS tenant_name, u.email AS tenant_email, u.phone AS tenant_phone,
            (SELECT le.id FROM leases le WHERE le.application_id = a.id) AS lease_id
     FROM applications a
     JOIN users u ON u.id = a.tenant_id
     WHERE a.listing_id = ?
     ORDER BY a.created_at DESC`,
    [listingId]
  );
  return res.json(rows);
});

// PATCH /api/applications/:id/status (owner)
leasingRouter.patch("/applications/:id/status", requireAuth, requireRole("owner"), async (req, res) => {
  const applicationId = String(req.params.id ?? "");
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!APPLICANT_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status must be under_review, approved, or rejected." });
  }

  const app = await loadApplication(applicationId);
  if (!app || app.owner_id !== req.user!.id) {
    return res.status(404).json({ error: "Application not found." });
  }
  if (await leaseExistsFor(app.id)) {
    return res.status(409).json({ error: "A lease already exists for this application." });
  }

  await pool.query("UPDATE applications SET status = ? WHERE id = ?", [status, app.id]);
  return res.json({ id: app.id, status });
});

// POST /api/applications/:id/lease (owner, approved applicants only)
leasingRouter.post("/applications/:id/lease", requireAuth, requireRole("owner"), async (req, res) => {
  const applicationId = String(req.params.id ?? "");
  const app = await loadApplication(applicationId);
  if (!app || app.owner_id !== req.user!.id) {
    return res.status(404).json({ error: "Application not found." });
  }
  if (app.status !== "approved") {
    return res.status(409).json({ error: "Approve the applicant before creating a lease." });
  }
  if (await leaseExistsFor(app.id)) {
    return res.status(409).json({ error: "A lease already exists for this application." });
  }

  const body = req.body ?? {};
  const rent =
    body.monthlyRent === undefined || body.monthlyRent === "" ? Number(app.monthly_rent) : Number(body.monthlyRent);
  const deposit = body.depositAmount === undefined || body.depositAmount === "" ? 0 : Number(body.depositAmount);
  const startDate = typeof body.startDate === "string" && body.startDate ? body.startDate : null;
  const endDate = typeof body.endDate === "string" && body.endDate ? body.endDate : null;

  if (!Number.isFinite(rent) || rent <= 0 || rent > MAX_AMOUNT) {
    return res.status(400).json({ error: "Monthly rent must be a positive amount." });
  }
  if (!Number.isFinite(deposit) || deposit < 0 || deposit > MAX_AMOUNT) {
    return res.status(400).json({ error: "Deposit must be zero or a positive amount." });
  }
  if ((startDate && !DATE_RE.test(startDate)) || (endDate && !DATE_RE.test(endDate))) {
    return res.status(400).json({ error: "Dates must be valid." });
  }
  if (startDate && endDate && endDate <= startDate) {
    return res.status(400).json({ error: "The end date must be after the start date." });
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO leases
       (id, application_id, listing_id, tenant_id, owner_id, status,
        monthly_rent, deposit_amount, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?)`,
    [id, app.id, app.listing_id, app.tenant_id, app.owner_id, rent, deposit, startDate, endDate]
  );
  return res.status(201).json({ id, status: "sent" });
});

// GET /api/leases/mine (tenant or owner)
// The address is shared only after both parties have signed.
leasingRouter.get("/leases/mine", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT le.id, le.status, le.monthly_rent, le.deposit_amount, le.start_date, le.end_date,
            le.tenant_id, le.owner_id, le.tenant_signed_at, le.owner_signed_at,
            l.title, loc.barangay,
            CASE WHEN le.status IN ('fully_signed', 'active') THEN l.address_line ELSE NULL END AS address_line,
            t.full_name AS tenant_name, o.full_name AS owner_name
     FROM leases le
     JOIN listings l ON l.id = le.listing_id
     JOIN locations loc ON loc.id = l.location_id
     JOIN users t ON t.id = le.tenant_id
     JOIN users o ON o.id = le.owner_id
     WHERE le.tenant_id = ? OR le.owner_id = ?
     ORDER BY le.created_at DESC`,
    [userId, userId]
  );
  return res.json(rows.map((r) => ({ ...r, my_role: r.owner_id === userId ? "owner" : "tenant" })));
});

// POST /api/leases/:id/sign
// Body: { typedName }. The name must match the account name exactly (ignoring case).
leasingRouter.post("/leases/:id/sign", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const leaseId = String(req.params.id ?? "");
  const typedName = typeof req.body?.typedName === "string" ? req.body.typedName.trim() : "";

  const [leases] = await pool.query<RowDataPacket[]>("SELECT * FROM leases WHERE id = ?", [leaseId]);
  const lease = leases[0];
  if (!lease) return res.status(404).json({ error: "Lease not found." });

  const party = lease.tenant_id === userId ? "tenant" : lease.owner_id === userId ? "owner" : null;
  if (!party) return res.status(404).json({ error: "Lease not found." });

  if (lease.status === "cancelled" || lease.status === "ended") {
    return res.status(409).json({ error: "This lease is no longer active." });
  }

  const [users] = await pool.query<RowDataPacket[]>("SELECT full_name FROM users WHERE id = ?", [userId]);
  const userInfo = users[0];
  if (!userInfo) return res.status(404).json({ error: "User not found." });
  const fullName: string = userInfo.full_name;
  if (!typedName || typedName.toLowerCase() !== fullName.trim().toLowerCase()) {
    return res.status(400).json({
      error: `Type your full name exactly as it is on your account (${fullName}).`,
    });
  }

  const signedField = party === "tenant" ? "tenant_signed_at" : "owner_signed_at";
  if (lease[signedField]) {
    return res.status(409).json({ error: "You have already signed this lease." });
  }

  const now = new Date();
  await pool.query(`UPDATE leases SET ${signedField} = ? WHERE id = ?`, [now, lease.id]);

  const tenantSigned = party === "tenant" ? now : lease.tenant_signed_at;
  const ownerSigned = party === "owner" ? now : lease.owner_signed_at;

  let status: string = lease.status;
  if (tenantSigned && ownerSigned) status = "fully_signed";
  else if (tenantSigned) status = "signed_by_tenant";

  await pool.query("UPDATE leases SET status = ? WHERE id = ?", [status, lease.id]);

  if (status === "fully_signed") {
    // The lease is complete, so the listing leaves the public search.
    await pool.query("UPDATE listings SET status = 'rented' WHERE id = ?", [lease.listing_id]);
  }

  return res.json({ id: lease.id, status, signedAs: party });
});