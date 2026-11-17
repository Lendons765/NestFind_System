import type { InquiryInput, InquiryResult, ListingDetail, ListingSummary, SearchFilters } from "../type";

const API_BASE = "http://localhost:4000";

export async function searchListings(filters: SearchFilters): Promise<ListingSummary[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.barangay) params.set("barangay", filters.barangay);
  if (filters.propertyType) params.set("propertyType", filters.propertyType);
  if (filters.maxRent) params.set("maxRent", filters.maxRent);
  if (filters.bedrooms) params.set("bedrooms", filters.bedrooms);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.amenities.length) params.set("amenities", filters.amenities.join(","));

  const res = await fetch(`${API_BASE}/api/listings?${params.toString()}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

// Returns null when the listing doesn't exist or isn't active.
export async function getListing(id: string): Promise<ListingDetail | null> {
  const res = await fetch(`${API_BASE}/api/listings/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load listing (${res.status})`);
  return res.json();
}

export async function sendInquiry(listingId: string, input: InquiryInput): Promise<InquiryResult> {
  const res = await fetch(`${API_BASE}/api/listings/${encodeURIComponent(listingId)}/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Could not send inquiry (${res.status})`);
  return body;
}

export async function getListingAddress(
  token: string,
  id: string
): Promise<{ addressLine: string | null }> {
  const res = await fetch(`${API_BASE}/api/listings/${encodeURIComponent(id)}/address`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}