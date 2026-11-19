import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchMyApplications, fetchMyLeases } from "../api/leasing";
import {
  cancelTenantViewing,
  fetchTenantConversations,
  fetchTenantSummary,
  fetchTenantViewings,
  sendTenantMessage,
} from "../api/tenant";
import type {
  ApplicationStatus,
  LeaseRow,
  MyApplication,
  TenantConversation,
  TenantViewing,
} from "../type";

type Tab = "overview" | "messages" | "viewings" | "movein";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "messages", label: "Messages" },
  { key: "viewings", label: "Viewings" },
  { key: "movein", label: "Move-in" },
];

const appLabel: Record<ApplicationStatus, string> = {
  submitted: "Sent to owner",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Declined",
  withdrawn: "Withdrawn",
};

const viewingLabel: Record<TenantViewing["status"], string> = {
  requested: "Waiting for owner",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

const viewingPill: Record<TenantViewing["status"], string> = {
  requested: "pill pill-requested",
  confirmed: "pill pill-confirmed",
  completed: "pill pill-draft",
  cancelled: "pill pill-cancelled",
  no_show: "pill pill-cancelled",
};

function formatDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "—";
}

function formatWhen(v: string) {
  return new Date(v).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * One sentence that always matches the counts and the lease status.
 */
function nextStep(apps: MyApplication[], leases: LeaseRow[], upcoming: number): string {
  const waitingSignature = leases.find(
    (l) => l.my_role === "tenant" && !l.tenant_signed_at && l.status !== "cancelled" && l.status !== "ended"
  );
  if (waitingSignature) return "Your lease is ready. Read it and sign on the Leases page.";

  const approved = apps.find((a) => a.status === "approved" && !a.lease_id);
  if (approved) return "You were approved. The owner will send the lease to sign.";

  const pending = apps.find((a) => a.status === "submitted" || a.status === "under_review");
  if (pending) return "Your application is with the owner. You'll see the result here.";

  if (upcoming > 0) return `You have ${upcoming} upcoming viewing(s). Check the Viewings tab.`;

  if (apps.length === 0) return "Find a place you like and send an application.";

  return "You're all caught up.";
}

function ConversationCard({ conv, token }: { conv: TenantConversation; token: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: () => sendTenantMessage(token, conv.id, body.trim()),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["tenant-conversations"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send.mutate();
  }

  return (
    <section className="inquiry-card">
      <div className="owner-card-head">
        <div>
          <h3>
            <Link to={`/listings/${conv.listingId}`}>{conv.listingTitle}</Link>
          </h3>
          <p className="muted">
            {conv.barangay} · Owner: {conv.ownerName}
          </p>
        </div>
      </div>

      <div className="thread">
        {conv.messages.map((m, i) => (
          <div key={i} className={`bubble${m.fromMe ? " me" : ""}`}>
            <div className="bubble-meta">
              {m.fromMe ? "You" : m.senderName} · {formatWhen(m.sentAt)}
            </div>
            <p>{m.body}</p>
          </div>
        ))}
      </div>

      <form className="reply-form" onSubmit={handleSubmit}>
        <textarea
          rows={2}
          maxLength={2000}
          placeholder="Write a message to the owner"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" disabled={send.isPending || !body.trim()}>
          {send.isPending ? "Sending…" : "Send"}
        </button>
      </form>
      {send.isError && <p className="error">{(send.error as Error).message}</p>}
    </section>
  );
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <li className={`check-item${done ? " done" : ""}`}>
      <span className="dot" />
      {label}
    </li>
  );
}

function LeaseCard({ lease }: { lease: LeaseRow }) {
  const startPassed = !!lease.start_date && new Date(lease.start_date) <= new Date();

  return (
    <section className="inquiry-card">
      <div className="owner-card-head">
        <div>
          <h3>{lease.title}</h3>
          <p className="muted">
            {lease.barangay} · ₱{Number(lease.monthly_rent).toLocaleString("en-PH")}/mo · Deposit ₱
            {Number(lease.deposit_amount).toLocaleString("en-PH")}
          </p>
          <p className="muted">
            Move-in {formatDate(lease.start_date)} · Lease ends {formatDate(lease.end_date)}
          </p>
        </div>
      </div>

      <ul className="checklist">
        <ChecklistItem label="Lease created by the owner" done />
        <ChecklistItem label="You signed the lease" done={!!lease.tenant_signed_at} />
        <ChecklistItem label="Owner signed the lease" done={!!lease.owner_signed_at} />
        <ChecklistItem label="Address shared with you" done={!!lease.address_line} />
        <ChecklistItem label="Move-in day" done={startPassed} />
      </ul>

      {lease.address_line ? (
        <p className="inquiry">
          <strong>Address:</strong> {lease.address_line}
        </p>
      ) : (
        <p className="muted">The address is shared once both parties have signed.</p>
      )}

      <p className="muted">
        Need to sign or review the agreement? Open <Link to="/leases">Leases</Link>.
      </p>
    </section>
  );
}

export default function TenantPortalPage() {
  const { user, token, loading } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const enabled = !!token && user?.role === "tenant";

  const summary = useQuery({
    queryKey: ["tenant-summary", token],
    queryFn: () => fetchTenantSummary(token!),
    enabled,
  });

  const conversations = useQuery({
    queryKey: ["tenant-conversations", token],
    queryFn: () => fetchTenantConversations(token!),
    enabled,
  });

  const viewings = useQuery({
    queryKey: ["tenant-viewings", token],
    queryFn: () => fetchTenantViewings(token!),
    enabled,
  });

  const applications = useQuery({
    queryKey: ["my-applications", token],
    queryFn: () => fetchMyApplications(token!),
    enabled,
  });

  const leases = useQuery({
    queryKey: ["my-leases", token],
    queryFn: () => fetchMyLeases(token!),
    enabled,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelTenantViewing(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-viewings"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-summary"] });
    },
  });

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!token || !user) {
    return (
      <main className="page">
        <p>
          Please <Link to="/login">log in</Link> to see your home.
        </p>
      </main>
    );
  }
  if (user.role !== "tenant") {
    return (
      <main className="page">
        <p>This page is for tenant accounts. Owners use My listings and the Dashboard.</p>
      </main>
    );
  }

  const myLeases = (leases.data ?? []).filter((l) => l.my_role === "tenant");
  const apps: MyApplication[] = applications.data ?? [];
  const upcoming = (viewings.data ?? []).filter(
    (v) => (v.status === "requested" || v.status === "confirmed") && new Date(v.scheduled_at) > new Date()
  );

  const counts: Record<Tab, number | undefined> = {
    overview: undefined,
    messages: conversations.data?.length,
    viewings: upcoming.length,
    movein: myLeases.length,
  };

  return (
    <main className="page">
      <div className="owner-toolbar">
        <h1 style={{ margin: 0 }}>My home</h1>
        <Link to="/search" className="button-link">Browse listings</Link>
      </div>

      <div className="owner-tabs portal-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {counts[t.key] !== undefined && <span className="tab-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="portal-section">
          <div className="stats">
            <Stat label="Applications" value={summary.data?.applications} />
            <Stat label="Pending applications" value={summary.data?.pending_applications} />
            <Stat label="Viewings waiting" value={summary.data?.viewings_requested} />
            <Stat label="Viewings confirmed" value={summary.data?.viewings_confirmed} />
            <Stat label="Conversations" value={summary.data?.conversations} />
            <Stat label="Leases" value={summary.data?.leases} />
          </div>

          <section className="inquiry-card next-step">
            <h2>Next step</h2>
            <p>{nextStep(apps, myLeases, upcoming.length)}</p>
          </section>

          {apps.length > 0 && (
            <section className="inquiry-card">
              <h2>Your applications</h2>
              {apps.map((a) => (
                <div key={a.id} className="queue-row">
                  <Link to={`/listings/${a.listing_id}`}>{a.title}</Link>
                  <div className="muted">
                    {a.barangay} · Applied {formatDate(a.created_at)} ·{" "}
                    <span className={a.status === "approved" ? "pill pill-confirmed" : "pill pill-requested"}>
                      {appLabel[a.status]}
                    </span>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="inquiry-card">
            <h2>Quick links</h2>
            <div className="quick-links">
              <Link to="/search" className="button-link small">Browse listings</Link>
              <Link to="/leases" className="button-link small">Leases</Link>
            </div>
          </section>
        </section>
      )}

      {tab === "messages" && (
        <section className="portal-section inbox">
          {conversations.isLoading && <p>Loading messages…</p>}
          {conversations.isError && <p className="error">{(conversations.error as Error).message}</p>}
          {conversations.data?.length === 0 && (
            <p>No messages yet. Send an inquiry from a listing to start a conversation.</p>
          )}
          {conversations.data?.map((c) => (
            <ConversationCard key={c.id} conv={c} token={token} />
          ))}
        </section>
      )}

      {tab === "viewings" && (
        <section className="portal-section inbox">
          {viewings.isLoading && <p>Loading viewings…</p>}
          {viewings.isError && <p className="error">{(viewings.error as Error).message}</p>}
          {viewings.data?.length === 0 && (
            <p>
              No viewings yet. Open a listing and choose <strong>Book a viewing</strong>.
            </p>
          )}
          {cancel.isError && <p className="error">{(cancel.error as Error).message}</p>}

          {viewings.data?.map((v) => {
            const cancellable = v.status === "requested" || v.status === "confirmed";
            return (
              <section key={v.id} className="inquiry-card">
                <div className="owner-card-head">
                  <div>
                    <h3>
                      <Link to={`/listings/${v.listing_id}`}>{v.title}</Link>
                    </h3>
                    <p className="muted">
                      {v.barangay} · {formatWhen(v.scheduled_at)}
                    </p>
                    {v.notes && <p className="muted">Your note: {v.notes}</p>}
                  </div>
                  <span className={viewingPill[v.status]}>{viewingLabel[v.status]}</span>
                </div>
                {cancellable && (
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={cancel.isPending}
                      onClick={() => {
                        if (window.confirm("Cancel this viewing?")) cancel.mutate(v.id);
                      }}
                    >
                      Cancel viewing
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </section>
      )}

      {tab === "movein" && (
        <section className="portal-section">
          {leases.isLoading && <p>Loading your move-in details…</p>}
          {leases.isError && <p className="error">{(leases.error as Error).message}</p>}

          {myLeases.length === 0 && (
            <section className="inquiry-card">
              <h2>No lease yet</h2>
              {apps.length === 0 ? (
                <p>
                  Apply for a place to start. <Link to="/search">Browse listings</Link>.
                </p>
              ) : (
                <p>
                  You have {apps.length} application(s). Once an owner approves one, a lease appears here to sign.
                </p>
              )}
            </section>
          )}

          {myLeases.map((lease) => (
            <LeaseCard key={lease.id} lease={lease} />
          ))}
        </section>
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