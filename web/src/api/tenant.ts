import type { TenantConversation, TenantSummary, TenantViewing } from "../type";

const API_BASE = "http://localhost:4000";

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

export const fetchTenantSummary = (token: string) =>
  call<TenantSummary>(token, "/api/tenant/summary");

export const fetchTenantConversations = (token: string) =>
  call<TenantConversation[]>(token, "/api/tenant/conversations");

export const fetchTenantViewings = (token: string) =>
  call<TenantViewing[]>(token, "/api/tenant/viewings");

export const sendTenantMessage = (token: string, conversationId: string, body: string) =>
  call<{ id: string }>(token, `/api/tenant/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });

export const cancelTenantViewing = (token: string, viewingId: string) =>
  call<{ id: string; status: string }>(
    token,
    `/api/tenant/viewings/${encodeURIComponent(viewingId)}/cancel`,
    { method: "PATCH" }
  );

export const bookViewing = (token: string, listingId: string, scheduledAt: string, notes?: string) =>
  call<{ id: string; status: string }>(token, `/api/tenant/listings/${encodeURIComponent(listingId)}/viewings`, {
    method: "POST",
    body: JSON.stringify({ scheduledAt, notes }),
  });