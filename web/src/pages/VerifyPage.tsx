import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../auth/AuthContext";
import { resendVerifyCode, verifyEmailCode, verifyEmailToken } from "../api/codes";

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const token = searchParams.get("token") ?? "";

  // Link path: sign in with the token from the email.
  const [linkError, setLinkError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmailToken(token)
      .then((data) => {
        adoptSession(data.token, data.user);
        navigate("/", { replace: true });
      })
      .catch((err) => setLinkError((err as Error).message));
  }, [token, adoptSession, navigate]);

  // Code path
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await verifyEmailCode(email.trim(), code.trim());
      setVerified(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    try {
      const res = await resendVerifyCode(email.trim());
      setNotice(res.message);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (token) {
    return (
      <main className="auth-page">
        <div className="auth-shell">
          <section className="auth-visual">
            <div className="auth-visual-top"><Logo /></div>
          </section>
          <section className="auth-panel">
            <h1>Confirming your email…</h1>
            {linkError ? (
              <>
                <p className="auth-error">{linkError}</p>
                <p className="auth-hint">
                  Enter the 6-digit code instead: <Link to="/verify">open the code form</Link>.
                </p>
              </>
            ) : (
              <p className="auth-notice">Please wait a moment.</p>
            )}
          </section>
        </div>
      </main>
    );
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
            <h2>Verify your email.</h2>
            <p>Enter the 6-digit code we sent you.</p>
          </div>
        </section>

        <section className="auth-panel">
          <h1>Enter your code</h1>

          {verified ? (
            <div className="auth-fields">
              <p className="auth-notice">Your email is verified.</p>
              <Link to="/login" className="auth-submit" style={{ textAlign: "center", textDecoration: "none" }}>
                Back to log in
              </Link>
            </div>
          ) : (
            <form className="auth-fields" onSubmit={handleVerify}>
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
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? "Checking…" : "Verify email"}
              </button>
              <p className="auth-hint">
                Didn't get it?{" "}
                <button type="button" className="link-btn" onClick={handleResend}>
                  Send a new code
                </button>
              </p>
              {notice && <p className="auth-notice">{notice}</p>}
              {error && <p className="auth-error">{error}</p>}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}