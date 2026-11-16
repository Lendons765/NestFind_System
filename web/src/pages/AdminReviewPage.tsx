import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { approveListing, fetchPendingListings, rejectListing } from "../api/admin";

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}/mo`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminReviewPage() {
  const { user, token, loading } = useAuth();
  const queryClient = useQueryClient();

  const pending = useQuery({
    queryKey: ["admin-pending", token],
    queryFn: () => fetchPendingListings(token!),
    enabled: !!token && user?.role === "admin",
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      if (action === "approve") return approveListing(token!, id);
      const reason = window.prompt("What should the owner change? The owner will see this message.") ?? "";
      if (!reason.trim()) throw new Error("A reason is required to send a listing back.");
      return rejectListing(token!, id, reason.trim());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending"] });
    },
  });

  if (loading) {
    return <main className="page"><p>Loading…</p></main>;
  }
  if (!token || !user) {
    return (
      <main className="page">
        <p>
          Please <Link to="/login">log in</Link> to review listings.
        </p>
      </main>
    );
  }
  if (user.role !== "admin") {
    return (
      <main className="page">
        <p>This page is only available to administrators.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Listings to review</h1>

      {pending.isLoading && <p>Loading…</p>}
      {pending.isError && <p className="error">{(pending.error as Error).message}</p>}
      {pending.data?.length === 0 && <p>Nothing is waiting for review.</p>}
      {decide.isError && <p className="error">{(decide.error as Error).message}</p>}

      <div className="inbox">
        {pending.data?.map((listing) => (
          <section key={listing.id} className="inquiry-card">
            <h3>{listing.title}</h3>
            <p className="muted">
              {listing.barangay} · {formatPeso(listing.monthly_rent)}
            </p>
            <p className="muted">
              Owner: {listing.owner_name} · {listing.owner_email}
            </p>
            <p className="muted">Submitted {formatDate(listing.created_at)}</p>

            <div className="viewing-row">
              <span>Decision needed</span>
              <div className="viewing-actions">
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: listing.id, action: "approve" })}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: listing.id, action: "reject" })}
                >
                  Send back
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}