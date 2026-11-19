import type {
  ApplyInput,
  LeaseInput,
  LeaseRow,
  ListingApplicant,
  MyApplication,
} from "../type";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function call<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
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

export function applyToListing(token: string, listingId: string, input: ApplyInput) {
  return call<{ id: string; status: string }>(token, `/api/listings/${encodeURIComponent(listingId)}/applications`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchMyApplications(token: string) {
  return call<MyApplication[]>(token, "/api/applications/mine");
}

export function fetchApplicants(token: string, listingId: string) {
  return call<ListingApplicant[]>(token, `/api/listings/${encodeURIComponent(listingId)}/applications`);
}

export function updateApplicationStatus(
  token: string,
  applicationId: string,
  status: "under_review" | "approved" | "rejected"
) {
  return call(token, `/api/applications/${encodeURIComponent(applicationId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function createLease(token: string, applicationId: string, input: LeaseInput) {
  return call<{ id: string; status: string }>(token, `/api/applications/${encodeURIComponent(applicationId)}/lease`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchMyLeases(token: string) {
  return call<LeaseRow[]>(token, "/api/leases/mine");
}

export function signLease(token: string, leaseId: string, typedName: string) {
  return call<{ id: string; status: string; signedAs: string }>(
    token,
    `/api/leases/${encodeURIComponent(leaseId)}/sign`,
    { method: "POST", body: JSON.stringify({ typedName }) }
  );
}