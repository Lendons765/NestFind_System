import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchListingForEdit, saveWalkthrough } from "../api/owner";
import { createLease, fetchApplicants, updateApplicationStatus } from "../api/leasing";
import type { ApplicationStatus, ListingApplicant } from "../type";

const appLabel: Record<ApplicationStatus, string> = {
  submitted: "New",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Declined",
  withdrawn: "Withdrawn",
};

function formatDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "—";
}

function WalkthroughSection({ listingId, token }: { listingId: string; token: string }) {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => saveWalkthrough(token, listingId, url.trim()),
    onSuccess: () => setSaved(true),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    save.mutate();
  }

  return (
    <section className="inquiry-card">
      <h2>Virtual walkthrough</h2>
      <p className="muted">
        Paste a link to a 360° tour or video (Matterport, YouTube, or similar). Saving replaces the previous link.
      </p>
      <form className="sign-form" onSubmit={handleSubmit}>
        <label>
          Walkthrough link
          <input
            type="url"
            required
            placeholder="https://..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save walkthrough"}
        </button>
        {saved && <p className="inquiry success">Walkthrough saved. It now appears on the public page.</p>}
        {save.isError && <p className="error">{(save.error as Error).message}</p>}
      </form>
    </section>
  );
}

function LeaseForm({
  applicationId,
  listingId,
  defaultRent,
  token,
}: {
  applicationId: string;
  listingId: string;
  defaultRent: number;
  token: string;
}) {
  const queryClient = useQueryClient();
  const [rent, setRent] = useState(String(defaultRent));
  const [deposit, setDeposit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createLease(token, applicationId, {
        monthlyRent: Number(rent),
        depositAmount: deposit === "" ? 0 : Number(deposit),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applicants", listingId] }),
  });

  return (
    <form
      className="sign-form"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <p>
        <strong>Create the lease</strong>
      </p>
      <label>
        Monthly rent (₱)
        <input type="number" min="1" required value={rent} onChange={(e) => setRent(e.target.value)} />
      </label>
      <label>
        Deposit (₱)
        <input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
      </label>
      <label>
        Start date
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <label>
        End date
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </label>
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create lease"}
      </button>
      {create.isError && <p className="error">{(create.error as Error).message}</p>}
    </form>
  );
}

function ApplicantCard({
  a,
  token,
  listingId,
  defaultRent,
}: {
  a: ListingApplicant;
  token: string;
  listingId: string;
  defaultRent: number;
}) {
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: (status: "under_review" | "approved" | "rejected") =>
      updateApplicationStatus(token, a.id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applicants", listingId] }),
  });

  const open = !a.lease_id && (a.status === "submitted" || a.status === "under_review");

  return (
    <section className="inquiry-card">
      <div className="owner-card-head">
        <div>
          <h3>{a.tenant_name}</h3>
          <p className="muted">
            {a.tenant_email}
            {a.tenant_phone ? ` · ${a.tenant_phone}` : ""}
          </p>
          <p className="muted">
            Applied {formatDate(a.created_at)} · Move-in {formatDate(a.desired_move_in)} ·{" "}
            {a.lease_term_months ? `${a.lease_term_months} months` : "term to be agreed"}
          </p>
        </div>
        <span className="pill pill-pending">{appLabel[a.status]}</span>
      </div>

      {open && (
        <div className="card-actions">
          {a.status === "submitted" && (
            <button type="button" className="btn-ghost" onClick={() => decide.mutate("under_review")}>
              Mark under review
            </button>
          )}
          <button type="button" onClick={() => decide.mutate("approved")}>
            Approve
          </button>
          <button type="button" className="btn-danger" onClick={() => decide.mutate("rejected")}>
            Decline
          </button>
        </div>
      )}

      {a.status === "approved" && !a.lease_id && (
        <LeaseForm applicationId={a.id} listingId={listingId} defaultRent={defaultRent} token={token} />
      )}

      {a.lease_id && (
        <p className="muted">
          Lease created. Both of you sign it on the <Link to="/leases">Leases</Link> page.
        </p>
      )}

      {decide.isError && <p className="error">{(decide.error as Error).message}</p>}
    </section>
  );
}

export default function ListingManagePage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, loading } = useAuth();
  const enabled = !!token && !!id && user?.role === "owner";

  const listing = useQuery({
    queryKey: ["owner-listing-manage", id, token],
    queryFn: () => fetchListingForEdit(token!, id!),
    enabled,
  });

  const applicants = useQuery({
    queryKey: ["applicants", id, token],
    queryFn: () => fetchApplicants(token!, id!),
    enabled,
  });

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!token || !user) {
    return (
      <main className="page">
        <p>
          Please <Link to="/login">log in</Link> to manage your listing.
        </p>
      </main>
    );
  }
  if (user.role !== "owner") {
    return (
      <main className="page">
        <p>Only owner accounts can manage listings.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <Link to="/my-listings">← Back to my listings</Link>
      <h1>{listing.data?.title ?? "Manage listing"}</h1>

      {listing.isError && <p className="error">{(listing.error as Error).message}</p>}

      <WalkthroughSection listingId={id!} token={token} />

      <h2>Applicants</h2>
      {applicants.isLoading && <p>Loading applicants…</p>}
      {applicants.isError && <p className="error">{(applicants.error as Error).message}</p>}
      {applicants.data?.length === 0 && (
        <p>No applicants yet. Tenants can apply from the listing page.</p>
      )}

      <div className="inbox">
        {applicants.data?.map((a) => (
          <ApplicantCard
            key={a.id}
            a={a}
            token={token}
            listingId={id!}
            defaultRent={Number(listing.data?.monthly_rent ?? 0)}
          />
        ))}
      </div>
    </main>
  );
}