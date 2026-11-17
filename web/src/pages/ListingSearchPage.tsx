import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchListings } from "../api/listings";
import type { ListingSummary, SearchFilters } from "../type";

const API_BASE = "http://localhost:4000";

const propertyTypes = [
  { value: "", label: "Any type" },
  { value: "boarding_house", label: "Boarding house" },
  { value: "studio", label: "Studio" },
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "house", label: "House" },
];

const bedroomOptions = [
  { value: "", label: "Any bedrooms" },
  { value: "studio", label: "Studio" },
  { value: "1", label: "1 bedroom" },
  { value: "2", label: "2 bedrooms" },
  { value: "3+", label: "3+ bedrooms" },
];

const amenityOptions = [
  { value: "aircon", label: "Air-conditioned" },
  { value: "wifi", label: "WiFi" },
  { value: "furnished", label: "Furnished" },
  { value: "parking", label: "Parking" },
];

const sortOptions = [
  { value: "", label: "Featured first" },
  { value: "rent_asc", label: "Lowest rent" },
  { value: "rent_desc", label: "Highest rent" },
  { value: "newest", label: "Newest" },
];

const EMPTY: SearchFilters = {
  q: "",
  barangay: "",
  propertyType: "",
  maxRent: "",
  bedrooms: "",
  sort: "",
  amenities: [],
};

function filtersFromParams(p: URLSearchParams): SearchFilters {
  return {
    q: p.get("q") ?? "",
    barangay: p.get("barangay") ?? "",
    propertyType: p.get("propertyType") ?? "",
    maxRent: p.get("maxRent") ?? "",
    bedrooms: p.get("bedrooms") ?? "",
    sort: p.get("sort") ?? "",
    amenities: (p.get("amenities") ?? "").split(",").filter(Boolean),
  };
}

function paramsFromFilters(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.barangay) p.set("barangay", f.barangay);
  if (f.propertyType) p.set("propertyType", f.propertyType);
  if (f.maxRent) p.set("maxRent", f.maxRent);
  if (f.bedrooms) p.set("bedrooms", f.bedrooms);
  if (f.sort) p.set("sort", f.sort);
  if (f.amenities.length) p.set("amenities", f.amenities.join(","));
  return p;
}

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}/mo`;
}

function ListingCard({ listing }: { listing: ListingSummary }) {
  const tags = [
    listing.is_furnished === 1 && "Furnished",
    listing.has_aircon === 1 && "Air-conditioned",
    listing.has_wifi === 1 && "WiFi",
    listing.has_parking === 1 && "Parking",
  ].filter(Boolean) as string[];

  return (
    <Link to={`/listings/${listing.id}`} className="card-link">
      <div className="card">
        {listing.cover_url ? (
          <img
            className="card-photo"
            src={`${API_BASE}${listing.cover_url}`}
            alt={listing.title}
            loading="lazy"
          />
        ) : (
          <div className="card-photo card-photo-empty" aria-hidden="true" />
        )}

        <div className="card-badges">
          {listing.is_featured === 1 && <span className="badge">Featured</span>}
          {listing.verification === "verified" && <span className="verified">✓ Verified</span>}
        </div>

        <h3>{listing.title}</h3>
        <p className="muted">
          {listing.barangay}, {listing.city}
        </p>
        <p className="price">{formatPeso(listing.monthly_rent)}</p>
        <p className="muted">
          {listing.bedrooms === 0 ? "Studio layout" : `${listing.bedrooms ?? "—"} bedroom(s)`}
          {tags.length > 0 && ` · ${tags.join(" · ")}`}
        </p>
      </div>
    </Link>
  );
}

export default function ListingSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlKey = searchParams.toString();
  // The filters that are actually applied come from the URL.
  const applied = filtersFromParams(new URLSearchParams(urlKey));
  // The draft holds what the user is typing before they press Search.
  const [draft, setDraft] = useState<SearchFilters>(applied);

  useEffect(() => {
    setDraft(filtersFromParams(new URLSearchParams(urlKey)));
  }, [urlKey]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["listings", urlKey],
    queryFn: () => searchListings(applied),
  });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setDraft((prev: SearchFilters) => ({ ...prev, [key]: value }));
  }

  function toggleAmenity(value: string) {
    setDraft((prev: SearchFilters) => ({
      ...prev,
      amenities: prev.amenities.includes(value)
        ? prev.amenities.filter((a: string) => a !== value)
        : [...prev.amenities, value],
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSearchParams(paramsFromFilters(draft));
  }

  function changeSort(value: string) {
    setSearchParams(paramsFromFilters({ ...applied, sort: value }));
  }

  function clearAll() {
    setDraft(EMPTY);
    setSearchParams(new URLSearchParams());
  }

  const count = data?.length ?? 0;
  const hasFilters = urlKey !== "";

  return (
    <main className="page">
      <h1>Find your next home in Cebu</h1>

      <form className="filters" onSubmit={handleSubmit}>
        <label>
          Location
          <input
            placeholder="e.g. Lahug, Cebu City"
            value={draft.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </label>

        <label>
          Barangay
          <select value={draft.barangay} onChange={(e) => set("barangay", e.target.value)}>
            <option value="">Any barangay</option>
            <option value="Lahug">Lahug</option>
            <option value="Banilad">Banilad</option>
            <option value="IT Park">IT Park</option>
          </select>
        </label>

        <label>
          Property type
          <select value={draft.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
            {propertyTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Bedrooms
          <select value={draft.bedrooms} onChange={(e) => set("bedrooms", e.target.value)}>
            {bedroomOptions.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
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
            onChange={(e) => set("maxRent", e.target.value)}
          />
        </label>

        <fieldset className="amenity-group">
          <legend>Amenities</legend>
          {amenityOptions.map((a) => (
            <label key={a.value} className="check">
              <input
                type="checkbox"
                checked={draft.amenities.includes(a.value)}
                onChange={() => toggleAmenity(a.value)}
              />
              {a.label}
            </label>
          ))}
        </fieldset>

        <div className="filters-actions">
          <button type="submit">Search</button>
          <button type="button" className="clear" onClick={clearAll} disabled={!hasFilters}>
            Clear filters
          </button>
        </div>
      </form>

      <div className="toolbar">
        <p className="result-count">
          {data ? `${count} listing${count === 1 ? "" : "s"} found` : ""}
        </p>
        <label className="sort-field">
          Sort by
          <select value={applied.sort} onChange={(e) => changeSort(e.target.value)}>
            {sortOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p>Loading listings…</p>}
      {isError && <p className="error">{(error as Error).message}</p>}

      {data && count === 0 && (
        <div className="empty">
          <p>No listings match your filters.</p>
          {hasFilters && (
            <button type="button" className="clear" onClick={clearAll}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="grid">
        {data?.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </main>
  );
}