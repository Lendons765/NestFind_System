import { API_BASE } from "../config";

const BASE = `${API_BASE}/api/owner/extras`;

async function call<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// ---------- Notes ----------

export type OwnerNote = {
  id: string;
  tenantId: string;
  tenantName: string;
  body: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
};

export const fetchNotes = (token: string, tenantId?: string) =>
  call<OwnerNote[]>(token, `/notes${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`);

export const createNote = (token: string, tenantId: string, body: string) =>
  call<{ id: string }>(token, "/notes", { method: "POST", body: JSON.stringify({ tenantId, body }) });

export const updateNote = (token: string, id: string, input: { body?: string; isDone?: boolean }) =>
  call<{ id: string }>(token, `/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteNote = (token: string, id: string) =>
  call<{ deleted: boolean }>(token, `/notes/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---------- Owner profile ----------

export type OwnerProfile = {
  exists: boolean;
  businessName: string | null;
  unitCount: number;
};

export const fetchProfile = (token: string) => call<OwnerProfile>(token, "/profile");

export const saveProfile = (token: string, input: { businessName: string | null; unitCount: number }) =>
  call<{ saved: boolean }>(token, "/profile", { method: "PUT", body: JSON.stringify(input) });

export const deleteProfile = (token: string) =>
  call<{ deleted: boolean }>(token, "/profile", { method: "DELETE" });

// ---------- Own account ----------

export type OwnAccount = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

export const fetchAccount = (token: string) => call<OwnAccount>(token, "/account");

export const updateAccount = (token: string, input: { fullName: string; phone: string | null }) =>
  call<{ saved: boolean }>(token, "/account", { method: "PUT", body: JSON.stringify(input) });