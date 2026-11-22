import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchOwnerDashboard } from "../api/dashboard";

import OwnerPeopleSection from "../components/OwnerPeopleSection";
import OwnerProfileCard from "../components/OwnerProfileCard";
import OwnerListingsTable from "../components/OwnerListingsTable";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

const applicantLabel: Record<string, string> = {
  submitted: "New",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Declined",
  withdrawn: "Withdrawn",
};

export default function OwnerDashboardPage() {
  const { user, token, loading } = useAuth();

  const data = useQuery({
    queryKey: ["owner-dashboard", token],
    queryFn: () => fetchOwnerDashboard(token!),
    enabled: !!token && user?.role === "owner",
    refetchInterval: 30000,
  });

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!token || !user) {
    return (
      <main className="page">
        <p>Please <Link to="/login">log in</Link> to see your dashboard.</p>
      </main>
    );
  }
  if (user.role !== "owner") {
    return (
      <main className="page">
        <p>This dashboard is only available to owner accounts.</p>
      </main>
    );
  }

  const d = data.data;
  const maxViews = Math.max(1, ...(d?.listings.map((l) => l.views) ?? [0]));

  const attention: { label: string; to: string }[] = [];
  if (d) {
    if (d.activity.new_applicants > 0) {
      attention.push({ label: `${d.activity.new_applicants} new applicant(s) to review`, to: "/my-listings" });
    }
    if (d.activity.viewing_requests > 0) {
      attention.push({ label: `${d.activity.viewing_requests} viewing request(s) to confirm`, to: "/inbox" });
    }
    if (d.activity.leases_to_sign > 0) {
      attention.push({ label: `${d.activity.leases_to_sign} lease(s) waiting for signature`, to: "/leases" });
    }
    if (d.totals.drafts > 0) {
      attention.push({ label: `${d.totals.drafts} draft(s) not yet published`, to: "/my-listings" });
    }
  }

  return (
    <main className="page owner-dash">
      <div className="owner-toolbar">
        <h1>Welcome, {user.fullName.split(" ")[0]}</h1>
        <Link to="/my-listings/new" className="button-link">+ New listing</Link>
      </div>

      {data.isLoading && <p>Loading your dashboard…</p>}
      {data.isError && <p className="error">{(data.error as Error).message}</p>}

      {d && (
        <>
          <div className="stats owner-stats">
            <Stat label="My listings" value={d.totals.listings} />
            <Stat label="Live" value={d.totals.live} />
            <Stat label="Drafts" value={d.totals.drafts} />
            <Stat label="Total views" value={d.totals.views} />
            <Stat label="Inquiries" value={d.activity.inquiries} />
            <Stat label="Applicants" value={d.activity.applicants} />
            <Stat label="Viewing requests" value={d.activity.viewing_requests} />
            <Stat label="Upcoming viewings" value={d.activity.upcoming_viewings} />
          </div>

          <section className="inquiry-card dash-attention">
            <h2>Needs your attention</h2>
            {attention.length === 0 ? (
              <p>You're all caught up.</p>
            ) : (
              <ul className="attention-list">
                {attention.map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <Link to={item.to} className="btn-ghost">Open</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="dash-grid">
            <section className="inquiry-card">
              <h2>Upcoming viewings</h2>
              {d.upcomingViewings.length === 0 && <p>No upcoming viewings.</p>}
              {d.upcomingViewings.map((v) => (
                <div key={v.id} className="queue-row">
                  <strong>{v.tenantName}</strong> · <Link to={`/listings/${v.listingId}`}>{v.title}</Link>
                  <div className="muted">
                    {formatDate(v.scheduledAt)} ·{" "}
                    <span className={`pill ${v.status === "confirmed" ? "pill-confirmed" : "pill-requested"}`}>
                      {v.status === "confirmed" ? "Confirmed" : "Waiting for you"}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section className="inquiry-card">
              <h2>Recent applicants</h2>
              {d.recentApplicants.length === 0 && <p>No applicants yet.</p>}
              {d.recentApplicants.map((a) => (
                <div key={a.id} className="queue-row">
                  <strong>{a.tenantName}</strong> applied for <em>{a.title}</em>
                  <div className="muted">
                    {formatDate(a.createdAt)} · {applicantLabel[a.status] ?? a.status}
                  </div>
                </div>
              ))}
            </section>

            <section className="inquiry-card">
              <h2>Recent inquiries</h2>
              {d.recentInquiries.length === 0 && <p>No inquiries yet.</p>}
              {d.recentInquiries.map((r) => (
                <div key={r.id} className="queue-row">
                  <strong>{r.tenantName}</strong> asked about <em>{r.title}</em>
                  <div className="muted">{formatDate(r.createdAt)}</div>
                </div>
              ))}
            </section>
          </div>

          <section className="inquiry-card">
            <h2>Listing performance</h2>
            {d.listings.length === 0 && <p>You don't have any listings yet.</p>}
            {d.listings.map((l) => (
              <div key={l.id} className="perf-row">
                <div className="perf-head">
                  <strong>{l.title}</strong>
                  <span className="muted">
                    {l.views} views · {l.inquiries} inquiries · {l.applicants} applicants · {l.viewings} viewings
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(l.views / maxViews) * 100}%` }} />
                </div>
                {l.status !== "draft" && (
                  <Link to={`/my-listings/${l.id}/manage`} className="muted">Manage →</Link>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      {token && (
        <>
          
          <OwnerProfileCard token={token} />
          <OwnerListingsTable token={token} />
          <OwnerPeopleSection token={token} />
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="stat">
      <div className="stat-value">{value ?? "–"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}