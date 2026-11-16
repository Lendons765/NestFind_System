import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchMyListings, submitListing } from "../api/owner";
import type { OwnerListingStatus } from "../types";

const statusLabels: Record<OwnerListingStatus, string> = {
  draft: "Draft (not visible to tenants)",
  pending_verification: "Waiting for review",
  active: "Live",
  paused: "Paused",
  rented: "Rented",
  archived: "Archived",
};

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}/mo`;
}

export default function OwnerListingsPage() {
  const { user, token, loading } = useAuth();
  const queryClient = useQueryClient();

  const listings = useQuery({
    queryKey: ["owner-listings", token],
    queryFn: () => fetchMyListings(token!),
    enabled: !!token && user?.role === "owner",
  });

  const submit = useMutation({
    mutationFn: (listingId: string) => submitListing(token!, listingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-listings"] });
    },
  });

  if (loading) {
    return <main className="page"><p>Loading…</p></main>;
  }
  if (!token || !user) {
    return (
      <main className="page">
        <p>
          Please <Link to="/login">log in</Link> to see your listings.
        </p>
      </main>
    );
  }
  if (user.role !== "owner") {
    return (
      <main className="page">
        <p>This page is only available to owner accounts.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>My listings</h1>
      <Link to="/my-listings/new" className="button-link">
        + New listing
      </Link>

      {listings.isLoading && <p>Loading listings…</p>}
      {listings.isError && <p className="error">{(listings.error as Error).message}</p>}
      {listings.data?.length === 0 && <p>You don't have any listings yet.</p>}
      {submit.isError && <p className="error">{(submit.error as Error).message}</p>}

      <div className="inbox">
        {listings.data?.map((listing) => (
          <section key={listing.id} className="inquiry-card">
            <h3>{listing.title}</h3>
            <p className="muted">
              {listing.barangay} · {formatPeso(listing.monthly_rent)} · {listing.photo_count} photo(s)
            </p>

            {listing.verification === "rejected" && listing.rejection_reason && (
              <p className="warning">Changes requested: {listing.rejection_reason}</p>
            )}

            <div className="viewing-row">
              <span>
                Status: <strong>{statusLabels[listing.status]}</strong>
              </span>
              {listing.status === "draft" && (
                <div className="viewing-actions">
                  <Link to={`/my-listings/${listing.id}/edit`} className="button-link small">
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={submit.isPending}
                    onClick={() => submit.mutate(listing.id)}
                  >
                    Submit for review
                  </button>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}