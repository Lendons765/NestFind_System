import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "./ConfirmDialog";
import { deleteDraft, fetchMyListings } from "../api/owner";
import type { OwnerListingRow } from "../type";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  active: "Live",
  pending_verification: "Waiting",
  paused: "Paused",
  rented: "Rented",
  archived: "Archived",
};

export default function OwnerListingsTable({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<OwnerListingRow | null>(null);

  const listings = useQuery({
    queryKey: ["owner-listings", token],
    queryFn: () => fetchMyListings(token),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDraft(token, id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["owner-listings"] });
    },
    onError: () => {
      // The error stays visible below the table; the dialog closes so it can be read.
      setPendingDelete(null);
    },
  });

  const isLive = pendingDelete?.status === "active";

  return (
    <section className="inquiry-card">
      <div className="section-head">
        <h2>Manage your listings</h2>
        <Link to="/my-listings/new">+ New listing</Link>
      </div>

      {listings.isLoading && <p>Loading listings…</p>}
      {listings.isError && <p className="error">{(listings.error as Error).message}</p>}
      {remove.isError && <p className="error">{(remove.error as Error).message}</p>}
      {listings.data?.length === 0 && <p>You don't have any listings yet.</p>}

      {listings.data && listings.data.length > 0 && (
        <div className="table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Barangay</th>
                <th>Rent</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.data.map((l) => (
                <tr key={l.id}>
                  <td>{l.title}</td>
                  <td>{l.barangay}</td>
                  <td>₱{Number(l.monthly_rent).toLocaleString("en-PH")}</td>
                  <td>{statusLabel[l.status] ?? l.status}</td>
                  <td>
                    <div className="card-actions">
                      <Link to={`/my-listings/${l.id}/edit`} className="btn-clear small-btn">
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn-danger small-btn"
                        disabled={remove.isPending}
                        onClick={() => setPendingDelete(l)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={isLive ? "Delete this live listing?" : "Delete this listing?"}
        message={
          isLive
            ? `"${pendingDelete?.title ?? ""}" is visible to tenants. Deleting it removes it from search, along with its photos, inquiries, applications, and viewings. This can't be undone.`
            : `"${pendingDelete?.title ?? ""}" and its photos will be removed. This can't be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        tone="danger"
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}