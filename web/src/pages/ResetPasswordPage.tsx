import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import { resetWithCode, resetWithToken } from "../api/codes";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      if (token) {
        await resetWithToken(token, password);
      } else {
        await resetWithCode(email.trim(), code.trim(), password);
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-visual">
          <div className="auth-visual-top">
            <Logo />
            <Link to="/login" className="auth-back">Back to log in →</Link>
          </div>
          <div className="auth-visual-caption">
            <h2>Choose a new password.</h2>
            <p>Use at least 8 characters.</p>
          </div>
        </section>

        <section className="auth-panel">
          <h1>Set new password</h1>

          {done ? (
            <div className="auth-fields">
              <p className="auth-notice">Your password has been reset. You can log in now.</p>
              <Link to="/login" className="auth-submit" style={{ textAlign: "center", textDecoration: "none" }}>
                Log in
              </Link>
            </div>
          ) : (
            <form className="auth-fields" onSubmit={handleSubmit}>
              {!token && (
                <>
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </>
              )}
              <input
                type="password"
                required
                minLength={8}
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? "Saving…" : "Reset password"}
              </button>
              {error && <p className="auth-error">{error}</p>}
              {!token && (
                <p className="auth-hint">
                  No code? <Link to="/forgot">Request a new one</Link>.
                </p>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}