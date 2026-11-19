import type { OwnerDashboard, PublicStats, UserDashboard } from "../type";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function get<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const fetchPublicStats = () => get<PublicStats>("/api/dashboard/public");
export const fetchOwnerDashboard = (token: string) => get<OwnerDashboard>("/api/dashboard/owner", token);
export const fetchUserDashboard = (token: string) => get<UserDashboard>("/api/dashboard/owner", token);