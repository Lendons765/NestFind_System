import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const dashboardRouter = Router();

const n = (v: unknown) => Number(v ?? 0);

interface ListingRow extends RowDataPacket {
  id: number;
  title: string;
  status: string;
  view_count: number;
  inquiries: number;
  applicants: number;
  viewings: number;
}

interface InquiryRow extends RowDataPacket {
  id: number;
  created_at: string;
  title: string;
  tenant_name: string;
}

interface ApplicantRow extends RowDataPacket {
  id: number;
  status: string;
  created_at: string;
  title: string;
  tenant_name: string;
}

interface ViewingRow extends RowDataPacket {
  id: number;
  scheduled_at: string;
  status: string;
  listing_id: number;
  title: string;
  tenant_name: string;
}

interface TotalsRow extends RowDataPacket {
  listings: number;
  live: number;
  drafts: number;
  views: number;
}

interface ActivityRow extends RowDataPacket {
  inquiries: number;
  applicants: number;
  new_applicants: number;
  viewing_requests: number;
  upcoming_viewings: number;
  leases_to_sign: number;
}

// GET /api/dashboard/public
// Homepage numbers only. No personal data.
dashboardRouter.get("/public", async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM listings WHERE status = 'active') AS live_listings,
       (SELECT COUNT(DISTINCT loc.barangay) FROM listings l
          JOIN locations loc ON loc.id = l.location_id WHERE l.status = 'active') AS barangays,
       (SELECT COUNT(*) FROM users WHERE role = 'owner') AS owners,
       (SELECT COUNT(*) FROM users WHERE role = 'tenant') AS tenants`
  );
  res.json(rows[0]);
});

// GET /api/dashboard/owner
// Everything the owner dashboard needs, for this owner only.
dashboardRouter.get("/owner", requireAuth, requireRole("owner"), async (req, res) => {
  const id = req.user!.id;

  const [totals] = await pool.query<TotalsRow[]>(
    `SELECT COUNT(*) AS listings,
            COALESCE(SUM(status = 'active'), 0) AS live,
            COALESCE(SUM(status = 'draft'), 0) AS drafts,
            COALESCE(SUM(view_count), 0) AS views
     FROM listings WHERE owner_id = ?`,
    [id]
  );

  const [activity] = await pool.query<ActivityRow[]>(
    `SELECT
       (SELECT COUNT(*) FROM conversations WHERE owner_id = ?) AS inquiries,
       (SELECT COUNT(*) FROM applications a JOIN listings l ON l.id = a.listing_id
          WHERE l.owner_id = ?) AS applicants,
       (SELECT COUNT(*) FROM applications a JOIN listings l ON l.id = a.listing_id
          WHERE l.owner_id = ? AND a.status = 'submitted') AS new_applicants,
       (SELECT COUNT(*) FROM viewings v JOIN listings l ON l.id = v.listing_id
          WHERE l.owner_id = ? AND v.status = 'requested') AS viewing_requests,
       (SELECT COUNT(*) FROM viewings v JOIN listings l ON l.id = v.listing_id
          WHERE l.owner_id = ? AND v.status = 'confirmed' AND v.scheduled_at > NOW()) AS upcoming_viewings,
       (SELECT COUNT(*) FROM leases WHERE owner_id = ? AND status IN ('sent', 'signed_by_tenant')) AS leases_to_sign`,
    [id, id, id, id, id, id]
  );

  const [listings] = await pool.query<ListingRow[]>(
    `SELECT l.id, l.title, l.status, l.view_count,
       (SELECT COUNT(*) FROM conversations c WHERE c.listing_id = l.id) AS inquiries,
       (SELECT COUNT(*) FROM applications a WHERE a.listing_id = l.id) AS applicants,
       (SELECT COUNT(*) FROM viewings v WHERE v.listing_id = l.id
          AND v.status IN ('requested', 'confirmed')) AS viewings
     FROM listings l
     WHERE l.owner_id = ?
     ORDER BY l.view_count DESC, l.created_at DESC`,
    [id]
  );

  const [inquiries] = await pool.query<InquiryRow[]>(
    `SELECT c.id, c.created_at, l.title, t.full_name AS tenant_name
     FROM conversations c
     JOIN listings l ON l.id = c.listing_id
     JOIN users t ON t.id = c.tenant_id
     WHERE c.owner_id = ?
     ORDER BY c.created_at DESC
     LIMIT 5`,
    [id]
  );

  const [applicants] = await pool.query<ApplicantRow[]>(
    `SELECT a.id, a.status, a.created_at, l.title, u.full_name AS tenant_name
     FROM applications a
     JOIN listings l ON l.id = a.listing_id
     JOIN users u ON u.id = a.tenant_id
     WHERE l.owner_id = ?
     ORDER BY a.created_at DESC
     LIMIT 5`,
    [id]
  );

  const [viewings] = await pool.query<ViewingRow[]>(
    `SELECT v.id, v.scheduled_at, v.status, l.id AS listing_id, l.title, u.full_name AS tenant_name
     FROM viewings v
     JOIN listings l ON l.id = v.listing_id
     JOIN users u ON u.id = v.tenant_id
     WHERE l.owner_id = ? AND v.status IN ('requested', 'confirmed') AND v.scheduled_at > NOW()
     ORDER BY v.scheduled_at ASC
     LIMIT 5`,
    [id]
  );

  const t = totals[0] ?? {
    listings: 0,
    live: 0,
    drafts: 0,
    views: 0,
  };
  const a = activity[0] ?? {
    inquiries: 0,
    applicants: 0,
    new_applicants: 0,
    viewing_requests: 0,
    upcoming_viewings: 0,
    leases_to_sign: 0,
  };

  res.json({
    totals: {
      listings: n(t.listings),
      live: n(t.live),
      drafts: n(t.drafts),
      views: n(t.views),
    },
    activity: {
      inquiries: n(a.inquiries),
      applicants: n(a.applicants),
      new_applicants: n(a.new_applicants),
      viewing_requests: n(a.viewing_requests),
      upcoming_viewings: n(a.upcoming_viewings),
      leases_to_sign: n(a.leases_to_sign),
    },
    listings: listings.map((l) => ({
      id: l.id,
      title: l.title,
      status: l.status,
      views: n(l.view_count),
      inquiries: n(l.inquiries),
      applicants: n(l.applicants),
      viewings: n(l.viewings),
    })),
    recentInquiries: inquiries.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      title: r.title,
      tenantName: r.tenant_name,
    })),
    recentApplicants: applicants.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      title: r.title,
      tenantName: r.tenant_name,
    })),
    upcomingViewings: viewings.map((r) => ({
      id: r.id,
      scheduledAt: r.scheduled_at,
      status: r.status,
      listingId: r.listing_id,
      title: r.title,
      tenantName: r.tenant_name,
    })),
  });
});