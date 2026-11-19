import type {
  ListingPhoto,
  NewListingInput,
  OwnerInquiry,
  OwnerListing,
  OwnerListingDetail,
  OwnerListingRow,
  OwnerViewing,
} from "../type";

const API_BASE = "http://localhost:4000";

async function authedRequest<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
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

export function fetchOwnerInquiries(token: string): Promise<OwnerInquiry[]> {
  return authedRequest<OwnerInquiry[]>(token, "/api/owner/inquiries");
}

export function updateViewingStatus(
  token: string,
  viewingId: string,
  status: "confirmed" | "cancelled"
): Promise<{ id: string; status: OwnerViewing["status"] }> {
  return authedRequest(token, `/api/owner/viewings/${encodeURIComponent(viewingId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function fetchOwnerListings(token: string): Promise<OwnerListing[]> {
  return authedRequest<OwnerListing[]>(token, "/api/owner/listings");
}

export function submitListing(
  token: string,
  listingId: string
): Promise<{ id: string; status: string }> {
  return authedRequest(token, `/api/owner/listings/${encodeURIComponent(listingId)}/submit`, {
    method: "POST",
  });
}

// Creates a draft. The owner comes from the token, not the request body.
export function createListing(
  token: string,
  input: NewListingInput
): Promise<{ id: string; status: string }> {
  return authedRequest(token, "/api/listings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}


export function fetchMyListings(token: string): Promise<OwnerListingRow[]> {
  return authedRequest<OwnerListingRow[]>(token, "/api/owner/listings");
}

export function fetchListingForEdit(token: string, listingId: string): Promise<OwnerListingDetail> {
  return authedRequest<OwnerListingDetail>(token, `/api/owner/listings/${encodeURIComponent(listingId)}`);
}

export async function saveListingEdits(
  token: string,
  listingId: string,
  input: NewListingInput
): Promise<{ id: string; status: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(
      `${API_BASE}/api/owner/listings/${encodeURIComponent(listingId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
    return data;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("The server took too long to respond. Check that the API is running, then try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadListingPhoto(token: string, listingId: string, file: File): Promise<ListingPhoto> {
  const form = new FormData();
  form.append("photo", file);
  // No Content-Type header here. The browser sets it, including the multipart boundary.
  const res = await fetch(`${API_BASE}/api/owner/listings/${encodeURIComponent(listingId)}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data as ListingPhoto;
}

export function deleteListingPhoto(token: string, listingId: string, photoId: string) {
  return authedRequest(
    token,
    `/api/owner/listings/${encodeURIComponent(listingId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" }
  );
}
export function deleteDraft(token: string, listingId: string) {
  return authedRequest(token, `/api/owner/listings/${encodeURIComponent(listingId)}`, {
    method: "DELETE",
  });
}

export function saveWalkthrough(token: string, listingId: string, url: string) {
  return authedRequest(token, `/api/owner/listings/${encodeURIComponent(listingId)}/walkthrough`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
