import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import { useAuth } from "../auth/AuthContext";

export default function VerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // React runs effects twice in development. A link can only be used once,
    // so the second run must not call the API again.
    if (started.current) return;
    started.current = true;

    const token = params.get("token");
    if (!token) {
      setError("This link is missing its token.");
      return;
    }

    verifyEmail(token)
      .then((data) => {
        adoptSession(data.token, data.user);
        navigate("/", { replace: true });
      })
      .catch((err) => setError((err as Error).message));
  }, [params, adoptSession, navigate]);

  if (error) {
    return (
      <main className="page">
        <div className="auth-card">
          <p className="error">{error}</p>
          <Link to="/login">Back to log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <p>Confirming your account…</p>
    </main>
  );
}