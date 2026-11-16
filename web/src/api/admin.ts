import type { PendingListing } from "../types";

const API_BASE = "http://localhost:4000";

async function adminRequest<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function fetchPendingListings(token: string): Promise<PendingListing[]> {
  return adminRequest<PendingListing[]>(token, "/api/admin/listings?status=pending_verification");
}

export function approveListing(token: string, listingId: string) {
  return adminRequest(token, `/api/admin/listings/${encodeURIComponent(listingId)}/approve`, {
    method: "POST",
  });
}

export function rejectListing(token: string, listingId: string, reason: string) {
  return adminRequest(token, `/api/admin/listings/${encodeURIComponent(listingId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}