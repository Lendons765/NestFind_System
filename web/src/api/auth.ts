import type { AuthResponse, AuthUser, Role, VerificationPending } from "../types";

const API_BASE = "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Returns a session for new accounts, or a "check your email" result when claiming.
export function register(input: {
  fullName: string;
  email: string;
  password: string;
  role: Role;
}): Promise<AuthResponse | VerificationPending> {
  return request<AuthResponse | VerificationPending>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(token: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function verifyEmail(token: string): Promise<AuthResponse> {
  return request<AuthResponse>(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}

export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}