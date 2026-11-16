import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchListings } from "../api/listings";
import type { ListingSummary, SearchFilters } from "../types";

const propertyTypes = [
  { value: "", label: "Any type" },
  { value: "boarding_house", label: "Boarding house" },
  { value: "studio", label: "Studio" },
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "house", label: "House" },
];

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}/mo`;
}

function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <Link to={`/listings/${listing.id}`} className="card-link">
      <div className="card">
        {listing.is_featured === 1 && <span className="badge">Featured</span>}
        <h3>{listing.title}</h3>
        <p className="muted">
          {listing.barangay}, {listing.city}
        </p>
        <p className="price">{formatPeso(listing.monthly_rent)}</p>
        <p className="muted">
          {listing.bedrooms === 0 ? "Studio layout" : `${listing.bedrooms ?? "—"} bedroom(s)`}
          {listing.has_aircon === 1 && " · Air-conditioned"}
          {listing.has_wifi === 1 && " · WiFi"}
        </p>
      </div>
    </Link>
  );
}

function filtersFromParams(params: URLSearchParams): SearchFilters {
  return {
    q: params.get("q") ?? "",
    barangay: params.get("barangay") ?? "",
    propertyType: params.get("propertyType") ?? "",
    maxRent: params.get("maxRent") ?? "",
  };
}

export default function ListingSearchPage() {
  const [searchParams] = useSearchParams();
  const fromUrl = filtersFromParams(searchParams);
  const [draft, setDraft] = useState<SearchFilters>(fromUrl);
  const [filters, setFilters] = useState<SearchFilters>(fromUrl);

  // When the URL changes (for example, from the homepage search), apply it.
  const urlKey = searchParams.toString();
  useEffect(() => {
    const next = filtersFromParams(new URLSearchParams(urlKey));
    setDraft(next);
    setFilters(next);
  }, [urlKey]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["listings", filters],
    queryFn: () => searchListings(filters),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFilters(draft);
  }

  return (
    <main className="page">
      <h1>Find your next home in Cebu</h1>

      <form className="filters" onSubmit={handleSubmit}>
        <label>
          Location
          <input
            placeholder="e.g. Lahug, Cebu City"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
        </label>

        <label>
          Barangay
          <select
            value={draft.barangay}
            onChange={(e) => setDraft({ ...draft, barangay: e.target.value })}
          >
            <option value="">Any barangay</option>
            <option value="Lahug">Lahug</option>
            <option value="Banilad">Banilad</option>
            <option value="IT Park">IT Park</option>
          </select>
        </label>

        <label>
          Property type
          <select
            value={draft.propertyType}
            onChange={(e) => setDraft({ ...draft, propertyType: e.target.value })}
          >
            {propertyTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Max rent (₱)
          <input
            type="number"
            min="0"
            placeholder="e.g. 10000"
            value={draft.maxRent}
            onChange={(e) => setDraft({ ...draft, maxRent: e.target.value })}
          />
        </label>

        <button type="submit">Search</button>
      </form>

      {isLoading && <p>Loading listings…</p>}
      {isError && <p className="error">{(error as Error).message}</p>}
      {data && data.length === 0 && <p>No listings match your filters.</p>}

      <div className="grid">
        {data?.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </main>
  );
}