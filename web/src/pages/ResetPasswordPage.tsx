import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await resetPassword(token, password);
      setMessage(data.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="page">
        <div className="auth-card">
          <p className="error">This reset link is missing its token.</p>
          <Link to="/forgot">Request a new link</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="auth-card">
        <h1>Choose a new password</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            New password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <p className="muted">Use at least 8 characters.</p>
          <button type="submit" disabled={busy || !!message}>
            {busy ? "Saving…" : "Save new password"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
        {message && (
          <>
            <p className="inquiry">{message}</p>
            <Link to="/login">Go to log in</Link>
          </>
        )}
      </div>
    </main>
  );
}