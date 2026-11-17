import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import {
  createListing,
  deleteDraft,
  fetchListingForEdit,
  fetchMyListings,
  submitListing,
} from "../api/owner";
import type { NewListingInput, OwnerListingRow } from "../type";

type Tab = "all" | "draft" | "pending" | "live" | "changes";

const tabs: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "live", label: "Live" },
];

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}/mo`;
}

function matchesTab(l: OwnerListingRow, tab: Tab) {
  switch (tab) {
    case "draft":
      return l.status === "draft" && l.verification !== "rejected";
    case "pending":
      return l.status === "pending_verification";
    case "live":
      return l.status === "active";
    case "changes":
      return l.status === "draft" && l.verification === "rejected";
    default:
      return true;
  }
}

function statusPill(l: OwnerListingRow) {
  if (l.status === "active") return { label: "Live", cls: "pill pill-live" };
  if (l.status === "pending_verification") {
    return { label: "Waiting for review", cls: "pill pill-pending" };
  }
  if (l.status === "draft" && l.verification === "rejected") {
    return { label: "Needs changes", cls: "pill pill-changes" };
  }
  if (l.status === "draft") {
    return { label: "Draft (not visible to tenants)", cls: "pill pill-draft" };
  }
  return { label: l.status.replace("_", " "), cls: "pill pill-draft" };
}

export default function OwnerListingsPage() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const listings = useQuery({
    queryKey: ["owner-listings", token],
    queryFn: () => fetchMyListings(token!),
    enabled: !!token && user?.role === "owner",
  });

  const counts = useMemo(() => {
    const all = listings.data ?? [];
    return Object.fromEntries(
      tabs.map((t) => [t.key, all.filter((l) => matchesTab(l, t.key)).length])
    ) as Record<Tab, number>;
  }, [listings.data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listings.data ?? []).filter(
      (l) =>
        matchesTab(l, tab) &&
        (!q || l.title.toLowerCase().includes(q) || l.barangay.toLowerCase().includes(q))
    );
  }, [listings.data, tab, search]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["owner-listings"] });

  const submit = useMutation({
    mutationFn: (id: string) => submitListing(token!, id),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDraft(token!, id),
    onSuccess: refresh,
  });

  // Copies a listing's details into a new draft, then opens it for editing.
  // Photos are not copied, so the owner can add new ones.
  async function duplicate(id: string) {
    setCopyError(null);
    setCopyingId(id);
    try {
      const d = await fetchListingForEdit(token!, id);
      const input: NewListingInput = {
        title: `${d.title} (copy)`,
        propertyType: d.property_type,
        locationId: d.location_id,
        monthlyRent: Number(d.monthly_rent),
        bedrooms: d.bedrooms ?? undefined,
        description: d.description ?? undefined,
        addressLine: d.address_line ?? undefined,
        houseRules: d.house_rules ?? undefined,
        isFurnished: d.is_furnished === 1,
        hasAircon: d.has_aircon === 1,
        hasWifi: d.has_wifi === 1,
        hasParking: d.has_parking === 1,
        hasGym: d.has_gym === 1,
      };
      const created = await createListing(token!, input);
      await refresh();
      navigate(`/my-listings/${created.id}/edit`);
    } catch (err) {
      setCopyError((err as Error).message);
    } finally {
      setCopyingId(null);
    }
  }

  function confirmDelete(l: OwnerListingRow) {
    if (window.confirm(`Delete the draft "${l.title}"? This can't be undone.`)) {
      remove.mutate(l.id);
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!token || !user) {
    return (
      <main className="page">
        <p>Please <Link to="/login">log in</Link> to see your listings.</p>
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

  const all = listings.data ?? [];

  return (
    <main className="page">
      <div className="owner-toolbar">
        <h1 style={{ margin: 0 }}>My listings</h1>
        <Link to="/my-listings/new" className="button-link">+ New listing</Link>
      </div>

      <div className="stats owner-stats">
        <Stat label="Total views" value={all.reduce((sum, l) => sum + l.view_count, 0)} />
        <Stat label="Applicants" value={all.reduce((sum, l) => sum + l.applicant_count, 0)} />
        <Stat label="Total" value={counts.all} />
        <Stat label="Live" value={counts.live} />
        <Stat label="Drafts" value={counts.draft} />

      </div>

      <div className="owner-toolbar">
        <div className="owner-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-btn ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <input
          className="search-input"
          placeholder="Search by title or barangay"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {listings.isLoading && <p>Loading listings…</p>}
      {listings.isError && <p className="error">{(listings.error as Error).message}</p>}
      {submit.isError && <p className="error">{(submit.error as Error).message}</p>}
      {remove.isError && <p className="error">{(remove.error as Error).message}</p>}
      {copyError && <p className="error">{copyError}</p>}

      {!listings.isLoading && all.length === 0 && (
        <div className="empty">
          <p>You don't have any listings yet.</p>
          <Link to="/my-listings/new" className="button-link">Create your first listing</Link>
        </div>
      )}

      {all.length > 0 && visible.length === 0 && (
        <div className="empty">
          <p>No listings match this view.</p>
        </div>
      )}

      <div className="inbox">
        {visible.map((l) => {
          const pill = statusPill(l);
          return (
            <section key={l.id} className="inquiry-card owner-card">
              <div className="owner-card-head">
                <div>
                  <h3>{l.title}</h3>
                  <p className="muted">
                    {l.barangay} · {formatPeso(l.monthly_rent)} · {l.photo_count} photo(s) · {l.view_count} views ·{" "}
                    {l.inquiry_count} inquiries · {l.applicant_count} applicants
                  </p>
                  {l.new_applicant_count > 0 && (
                    <span className="pill pill-changes">{l.new_applicant_count} new applicant(s)</span>
                  )}
                </div>
                <span className={pill.cls}>{pill.label}</span>
              </div>

              {l.verification === "rejected" && l.rejection_reason && (
                <p className="warning">Changes requested: {l.rejection_reason}</p>
              )}

              <div className="card-actions">
                {l.status !== "draft" && (
                  <Link to={`/my-listings/${l.id}/manage`} className="btn-ghost">
                    Applicants
                  </Link>
                )}
                {l.status === "draft" && (
                  <button
                    type="button"
                    disabled={submit.isPending}
                    onClick={() => submit.mutate(l.id)}
                  >
                    Submit for review
                  </button>
                )}
                {l.status === "active" && (
                  <Link to={`/listings/${l.id}`} className="btn-ghost">View public page</Link>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={copyingId !== null}
                  onClick={() => duplicate(l.id)}
                >
                  {copyingId === l.id ? "Copying…" : "Duplicate"}
                </button>
                {l.status === "draft" && (
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={remove.isPending}
                    onClick={() => confirmDelete(l)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
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