import type { LocationOption } from "../types";

const API_BASE = "http://localhost:4000";

export async function fetchLocations(): Promise<LocationOption[]> {
  const res = await fetch(`${API_BASE}/api/locations`);
  if (!res.ok) throw new Error(`Could not load locations (${res.status})`);
  return res.json();
}