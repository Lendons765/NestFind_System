import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchListings } from "../api/listings";
import type { ListingSummary, SearchFilters } from "../types";


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
    <div className="listing-tile">
      <Link to={`/listings/${listing.id}`} className="listing-tile-link">
        <div className="listing-photo">
          {listing.cover_url ? (
            <img src={`${API_BASE}${listing.cover_url}`} alt={listing.title} loading="lazy" />
          ) : (
            <div className="listing-photo-empty" aria-hidden="true">
              <span>No photo yet</span>
            </div>
          )}
          <div className="listing-badges">
            {listing.is_featured === 1 && <span className="badge-featured">Featured</span>}
            {listing.verification === "verified" && <span className="badge-verified">✓ Verified</span>}
          </div>
        </div>

        <div className="listing-body">
          <p className="listing-price">{formatPeso(listing.monthly_rent)}</p>
          <h3>{listing.title}</h3>
          <p className="listing-place">
            {listing.barangay}, {listing.city}
          </p>
          <p className="listing-meta">
            {listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms ?? "—"} bedroom(s)`}
          </p>
          {tags.length > 0 && (
            <div className="listing-tags">
              {tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
      
    </div>
  );
}

export default function ListingSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlKey = searchParams.toString();
  const applied = filtersFromParams(new URLSearchParams(urlKey));
  const [draft, setDraft] = useState<SearchFilters>(applied);

  useEffect(() => {
    setDraft(filtersFromParams(new URLSearchParams(urlKey)));
  }, [urlKey]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["listings", urlKey],
    queryFn: () => searchListings(applied),
  });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAmenity(value: string) {
    setDraft((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(value)
        ? prev.amenities.filter((a) => a !== value)
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
    <main className="browse-page">
      <header className="browse-hero">
        <h1>Find your next home in Cebu</h1>
        <p>Verified listings, direct messages with owners, and viewings you can book in a few taps.</p>
      </header>

      <form className="browse-filters" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <label className="filter-field">
            <span>Location</span>
            <input
              placeholder="e.g. Lahug, Cebu City"
              value={draft.q}
              onChange={(e) => set("q", e.target.value)}
            />
          </label>

          <label className="filter-field">
            <span>Barangay</span>
            <select value={draft.barangay} onChange={(e) => set("barangay", e.target.value)}>
              <option value="">Any barangay</option>
              <option value="Lahug">Lahug</option>
              <option value="Banilad">Banilad</option>
              <option value="IT Park">IT Park</option>
            </select>
          </label>

          <label className="filter-field">
            <span>Property type</span>
            <select value={draft.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
              {propertyTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Bedrooms</span>
            <select value={draft.bedrooms} onChange={(e) => set("bedrooms", e.target.value)}>
              {bedroomOptions.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Max rent (₱)</span>
            <input
              type="number"
              min="0"
              placeholder="e.g. 10000"
              value={draft.maxRent}
              onChange={(e) => set("maxRent", e.target.value)}
            />
          </label>
        </div>

        <div className="amenity-row">
          <span className="amenity-label">Amenities</span>
          <div className="amenity-pills">
            {amenityOptions.map((a) => {
              const on = draft.amenities.includes(a.value);
              return (
                <button
                  key={a.value}
                  type="button"
                  className={`amenity-pill${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleAmenity(a.value)}
                >
                  {on && <span aria-hidden="true">✓</span>}
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-actions">
          <button type="submit" className="btn-search">
            Search listings
          </button>
          <button type="button" className="btn-clear" onClick={clearAll} disabled={!hasFilters}>
            Clear all
          </button>
        </div>
      </form>

      <div className="results-bar">
        <p className="results-count">
          {data ? (
            <>
              <strong>{count}</strong> listing{count === 1 ? "" : "s"} found
            </>
          ) : (
            ""
          )}
        </p>
        <label className="sort-control">
          <span>Sort by</span>
          <select value={applied.sort} onChange={(e) => changeSort(e.target.value)}>
            {sortOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && (
        <div className="grid-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-tile" />
          ))}
        </div>
      )}

      {isError && <p className="error">{(error as Error).message}</p>}

      {data && count === 0 && (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">⌂</div>
          <h2>No places match these filters</h2>
          <p>Try a wider rent range, another barangay, or fewer amenities.</p>
          {hasFilters && (
            <button type="button" className="btn-clear" onClick={clearAll}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="listing-grid">
        {data?.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </main>
  );
}