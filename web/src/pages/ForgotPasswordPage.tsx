import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await requestPasswordReset(email);
      setMessage(data.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="auth-card">
        <h1>Forgot password</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Please wait…" : "Send reset link"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
        {message && <p className="inquiry">{message}</p>}
        <p>
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </main>
  );
}