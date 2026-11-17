import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchUserDashboard } from "../api/dashboard";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

export default function UserDashboardPage() {
  const { user, token, loading } = useAuth();

  const data = useQuery({
    queryKey: ["user-dashboard", token],
    queryFn: () => fetchUserDashboard(token!),
    enabled: !!token && (user?.role === "owner" || user?.role === "tenant"),
  });

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!token || !user) {
    return (
      <main className="page">
        <p>Please <Link to="/login">log in</Link> to see your dashboard.</p>
      </main>
    );
  }
  

  const d = data.data;

  return (
    <main className="page">
      <h1>Welcome, {user.fullName.split(" ")[0]}</h1>

      {data.isLoading && <p>Loading…</p>}
      {data.isError && <p className="error">{(data.error as Error).message}</p>}

      {d?.role === "owner" && (
        <>
          <div className="stats">
            <Stat label="My listings" value={d.stats.total} />
            <Stat label="Live" value={d.stats.live} />
            <Stat label="Drafts" value={d.stats.drafts} />
            <Stat label="Waiting for review" value={d.stats.pending} />
            <Stat label="Inquiries" value={d.stats.inquiries} />
            <Stat label="Viewing requests" value={d.stats.viewing_requests} />
          </div>

          <section className="inquiry-card">
            <div className="section-head">
              <h2>Recent inquiries</h2>
              <Link to="/inbox">Open inbox</Link>
            </div>
            {d.recent?.length === 0 && <p>No inquiries yet.</p>}
            {d.recent?.map((r, i) => (
              <div key={i} className="queue-row">
                <strong>{r.tenant_name}</strong> asked about <em>{r.title}</em>
                <div className="muted">{formatDate(r.created_at)}</div>
              </div>
            ))}
          </section>

          <section className="inquiry-card">
            <h2>Quick links</h2>
            <div className="quick-links">
              <Link to="/my-listings" className="button-link small">My listings</Link>
              <Link to="/my-listings/new" className="button-link small">New listing</Link>
              <Link to="/inbox" className="button-link small secondary-link">Inbox</Link>
            </div>
          </section>
        </>
      )}

      {d?.role === "tenant" && (
        <>
          <div className="stats">
            <Stat label="Inquiries sent" value={d.stats.inquiries} />
            <Stat label="Viewings pending" value={d.stats.requested} />
            <Stat label="Viewings confirmed" value={d.stats.confirmed} />
          </div>

          <section className="inquiry-card">
            <h2>Upcoming viewings</h2>
            {d.upcoming?.length === 0 && <p>No viewings yet. Send an inquiry from a listing.</p>}
            {d.upcoming?.map((v, i) => (
              <div key={i} className="queue-row">
                <Link to={`/listings/${v.listing_id}`}>{v.title}</Link>
                <div className="muted">
                  {formatDate(v.scheduled_at)} · <strong>{v.status}</strong>
                </div>
              </div>
            ))}
          </section>

          <section className="inquiry-card">
            <h2>Quick links</h2>
            <div className="quick-links">
              <Link to="/search" className="button-link small">Search listings</Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="stat">
      <div className="stat-value">{value ?? "–"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}