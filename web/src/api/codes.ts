import { API_BASE } from "../config";
import type { AuthUser } from "../type";

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/auth${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function requestReset(email: string) {
  return request<{ message: string }>("/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetWithCode(email: string, code: string, password: string) {
  return request<{ message: string }>("/password/reset", {
    method: "POST",
    body: JSON.stringify({ email, code, password }),
  });
}

export function resetWithToken(token: string, password: string) {
  return request<{ message: string }>("/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function verifyEmailCode(email: string, code: string) {
  return request<{ verified: boolean }>("/codes/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function resendVerifyCode(email: string) {
  return request<{ message: string }>("/codes/resend", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// The sign-up link from the email. Returns a session, like login.
export function verifyEmailToken(token: string) {
  return request<{ token: string; user: AuthUser }>(`/verify?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });
}