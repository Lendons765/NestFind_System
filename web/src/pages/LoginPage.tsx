import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";


export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"tenant" | "owner">("tenant");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login"
  );
  

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
        navigate("/");
      } else {
        const outcome = await register({ fullName, email, password, role });
        if (outcome === "signed_in") {
          navigate("/");
        } else {
          setNotice(
            "We sent a confirmation link to this email. Open it to finish setting up your account."
          );
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label>
                Full name
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>

              <label>
                I am a
                <select value={role} onChange={(e) => setRole(e.target.value as "tenant" | "owner")}>
                  <option value="tenant">Tenant (looking for a place)</option>
                  <option value="owner">Owner (listing a place)</option>
                </select>
              </label>
            </>
          )}

          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {mode === "register" && <p className="muted">Use at least 8 characters.</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>

          {error && <p className="error">{error}</p>}
        </form>

        {notice && <p className="inquiry">{notice}</p>}
        <p className="muted" style={{ marginTop: "0.8rem" }}>
          <Link to="/forgot">Forgot password?</Link>
        </p>
      </div>
    </main>
  );
}