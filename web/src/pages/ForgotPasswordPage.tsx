import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { requestReset } from "../api/codes";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestReset(email.trim());
      setSent(true);
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
            <h2>Forgot your password?</h2>
            <p>We'll email you a 6-digit code and a reset link.</p>
          </div>
        </section>

        <section className="auth-panel">
          <h1>Reset password</h1>

          {sent ? (
            <div className="auth-fields">
              <p className="auth-notice">
                If an account exists for {email.trim()}, a code and a reset link are on their way.
                The code expires in 15 minutes.
              </p>
              <button
                type="button"
                className="auth-submit"
                onClick={() => navigate(`/reset?email=${encodeURIComponent(email.trim())}`)}
              >
                Enter my code
              </button>
            </div>
          ) : (
            <form className="auth-fields" onSubmit={handleSubmit}>
              <p className="auth-switch">Enter the email you signed up with.</p>
              <input
                type="email"
                required
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? "Sending…" : "Send code"}
              </button>
              {error && <p className="auth-error">{error}</p>}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}