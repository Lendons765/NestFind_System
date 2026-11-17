import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchMyApplications, fetchMyLeases, signLease } from "../api/leasing";
import type { ApplicationStatus, LeaseRow, LeaseStatus } from "../type";

const appLabel: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Declined",
  withdrawn: "Withdrawn",
};

const leaseLabel: Record<LeaseStatus, string> = {
  draft: "Draft",
  sent: "Waiting for signatures",
  signed_by_tenant: "Signed by tenant",
  fully_signed: "Fully signed",
  active: "Active",
  ended: "Ended",
  cancelled: "Cancelled",
};

function formatDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "—";
}

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}`;
}

function LeaseCard({ lease, token }: { lease: LeaseRow; token: string }) {
  const queryClient = useQueryClient();
  const [typedName, setTypedName] = useState("");
  const isTenant = lease.my_role === "tenant";
  const mySigned = isTenant ? lease.tenant_signed_at : lease.owner_signed_at;
  const otherSigned = isTenant ? lease.owner_signed_at : lease.tenant_signed_at;
  const otherName = isTenant ? lease.owner_name : lease.tenant_name;
  const closed = lease.status === "cancelled" || lease.status === "ended";

  const sign = useMutation({
    mutationFn: () => signLease(token, lease.id, typedName),
    onSuccess: () => {
      setTypedName("");
      queryClient.invalidateQueries({ queryKey: ["my-leases"] });
    },
  });

  return (
    <section className="inquiry-card lease-card">
      <div className="owner-card-head">
        <div>
          <h3>{lease.title}</h3>
          <p className="muted">
            {lease.barangay} · {formatPeso(lease.monthly_rent)}/mo · Deposit {formatPeso(lease.deposit_amount)}
          </p>
          <p className="muted">
            {lease.start_date
              ? `${formatDate(lease.start_date)} to ${formatDate(lease.end_date)}`
              : "Dates to be confirmed"}
          </p>
        </div>
        <span className="pill pill-pending">{leaseLabel[lease.status]}</span>
      </div>

      <div className="sig-grid">
        <div className="sig-line">
          <strong>You ({isTenant ? "tenant" : "owner"})</strong>
          <span>{mySigned ? `Signed ${formatDate(mySigned)}` : "Not signed yet"}</span>
        </div>
        <div className="sig-line">
          <strong>
            {otherName} ({isTenant ? "owner" : "tenant"})
          </strong>
          <span>{otherSigned ? `Signed ${formatDate(otherSigned)}` : "Waiting for signature"}</span>
        </div>
      </div>

      {lease.address_line ? (
        <p className="inquiry">
          <strong>Address:</strong> {lease.address_line}
        </p>
      ) : (
        <p className="muted">The address is shared once both parties have signed.</p>
      )}

      {!mySigned && !closed && (
        <form
          className="sign-form"
          onSubmit={(e) => {
            e.preventDefault();
            sign.mutate();
          }}
        >
          <label>
            Type your full name to sign
            <input value={typedName} onChange={(e) => setTypedName(e.target.value)} required />
          </label>
          <button type="submit" disabled={sign.isPending}>
            {sign.isPending ? "Signing…" : "Sign lease"}
          </button>
          {sign.isError && <p className="error">{(sign.error as Error).message}</p>}
        </form>
      )}
    </section>
  );
}

export default function LeasesPage() {
  const { user, token, loading } = useAuth();

  const apps = useQuery({
    queryKey: ["my-applications", token],
    queryFn: () => fetchMyApplications(token!),
    enabled: !!token && user?.role === "tenant",
  });

  const leases = useQuery({
    queryKey: ["my-leases", token],
    queryFn: () => fetchMyLeases(token!),
    enabled: !!token && (user?.role === "tenant" || user?.role === "owner"),
  });

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!token || !user) {
    return (
      <main className="page">
        <p>
          Please <Link to="/login">log in</Link> to see your leases.
        </p>
      </main>
    );
  }
  if (user.role === "admin") {
    return (
      <main className="page">
        <p>Admins review listings from the Review page.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Leases</h1>

      {user.role === "tenant" && (
        <section>
          <h2>My applications</h2>
          {apps.isLoading && <p>Loading…</p>}
          {apps.isError && <p className="error">{(apps.error as Error).message}</p>}
          {apps.data?.length === 0 && (
            <p>
              You haven't applied for any place yet. <Link to="/search">Browse listings</Link>.
            </p>
          )}
          <div className="inbox">
            {apps.data?.map((a) => (
              <section key={a.id} className="inquiry-card">
                <div className="owner-card-head">
                  <div>
                    <h3>{a.title}</h3>
                    <p className="muted">
                      {a.barangay} · Applied {formatDate(a.created_at)}
                    </p>
                  </div>
                  <span className="pill pill-pending">{appLabel[a.status]}</span>
                </div>
                <p className="muted">
                  Move-in {formatDate(a.desired_move_in)} · Lease{" "}
                  {a.lease_term_months ? `${a.lease_term_months} months` : "to be agreed"}
                </p>
              </section>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Lease agreements</h2>
        {leases.isLoading && <p>Loading…</p>}
        {leases.isError && <p className="error">{(leases.error as Error).message}</p>}
        {leases.data?.length === 0 && (
          <p>
            No lease yet. {user.role === "owner" ? "Create one from Manage on your listing." : "Your owner will send one after approval."}
          </p>
        )}
        {leases.data?.map((lease) => (
          <LeaseCard key={lease.id} lease={lease} token={token} />
        ))}
      </section>
    </main>
  );
}