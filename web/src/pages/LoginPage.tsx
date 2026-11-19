import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Logo from "../components/Logo";

type Mode = "login" | "register";
type Role = "tenant" | "owner";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode: Mode = searchParams.get("mode") === "register" ? "register" : "login";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("tenant");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  function switchMode(next: Mode) {
    setError(null);
    setNotice(null);
    setSearchParams(next === "register" ? { mode: "register" } : {});
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (isRegister && !agreed) {
      setError("Please accept the Terms & Conditions to continue.");
      return;
    }

    setSubmitting(true);
    try {
      if (!isRegister) {
        await login(email, password);
        navigate("/");
      } else {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
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
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-visual">
          <div className="auth-visual-top">
            <Logo />
            <Link to="/" className="auth-back">
              Back to website →
            </Link>
          </div>

          <div className="auth-visual-caption">
            <h2>Find your nest.</h2>
            <p>Verified rentals across Cebu, made simple.</p>
            <div className="auth-dots" aria-hidden="true">
              <span className="active" />
              <span />
              <span />
            </div>
          </div>
        </section>

        <section className="auth-panel" key={mode}>
          <h1>{isRegister ? "Create an account" : "Welcome back"}</h1>
          <p className="auth-switch">
            {isRegister ? (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}>
                  Log in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button type="button" onClick={() => switchMode("register")}>
                  Create an account
                </button>
              </>
            )}
          </p>

          <form className="auth-fields" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="auth-row">
                  <input
                    required
                    placeholder="First name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <input
                    placeholder="Last name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>

                <div className="auth-role" role="group" aria-label="I am a">
                  <button
                    type="button"
                    className={role === "tenant" ? "active" : ""}
                    onClick={() => setRole("tenant")}
                  >
                    Tenant
                  </button>
                  <button
                    type="button"
                    className={role === "owner" ? "active" : ""}
                    onClick={() => setRole("owner")}
                  >
                    Owner
                  </button>
                </div>
              </>
            )}

            <input
              type="email"
              required
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="auth-password">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Enter your password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {isRegister ? (
              <p className="auth-hint">Use at least 8 characters.</p>
            ) : (
              <p className="auth-forgot">
                <Link to="/forgot">Forgot password?</Link>
              </p>
            )}

            {isRegister && (
              <label className="auth-terms">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>I agree to the Terms &amp; Conditions</span>
              </label>
            )}

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? "Please wait…" : isRegister ? "Create account" : "Log in"}
            </button>

            {error && <p className="auth-error">{error}</p>}
            {notice && <p className="auth-notice">{notice}</p>}
          </form>

          <div className="auth-divider">
            <span>Or {isRegister ? "register" : "log in"} with</span>
          </div>
          <div className="auth-social">
            <button type="button" disabled title="Coming soon">
              Google
            </button>
            <button type="button" disabled title="Coming soon">
              Apple
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}