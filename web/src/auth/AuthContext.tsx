import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { fetchMe, login as apiLogin, register as apiRegister } from "../api/auth";
import type { AuthUser, Role } from "../type";

const TOKEN_KEY = "nestfind_token";

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  role: Role;
}

// "registered": account created, user goes to the login form.
// "verification_sent": an existing inquiry account needs an email confirmation.
type RegisterOutcome = "registered" | "verification_sent";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterOutcome>;
  adoptSession: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchMe(token)
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function saveSession(newToken: string, newUser: AuthUser) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function login(email: string, password: string) {
    const data = await apiLogin(email, password);
    saveSession(data.token, data.user);
  }

  async function register(input: RegisterInput): Promise<RegisterOutcome> {
    const data = (await apiRegister(input)) as {
      token?: string;
      user?: AuthUser;
      status?: string;
    };

    // Older responses included a session. Keep this so nothing breaks if it returns.
    if (data.token && data.user) {
      saveSession(data.token, data.user);
      return "registered";
    }

    if (data.status === "verification_sent") return "verification_sent";
    return "registered";
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, adoptSession: saveSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}