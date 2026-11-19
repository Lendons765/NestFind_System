import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ConfirmDialog from "./ConfirmDialog";
import Logo from "./Logo";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu after moving to another page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function handleConfirmLogout() {
    setConfirmOpen(false);
    logout();
    navigate("/");
  }

  return (
    <header className={`nf-header${menuOpen ? " menu-open" : ""}`}>
      <Logo />

      <button
        type="button"
        className="menu-toggle"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav>
        <div className="nav-links">
          {!user && <Link to="/">Home</Link>}
          {!user && <Link to="/#about">About</Link>}
          {!user && <Link to="/#contact">Contact</Link>}
          {user && <Link to="/search">Browse</Link>}
        </div>

        <div className="nav-auth">
          {user ? (
            <>
              {user.role === "tenant" && <Link to="/my-home">My home</Link>}
              {user.role === "tenant" && <Link to="/saved">Saved</Link>}
              {user.role === "owner" && <Link to="/my-listings">My listings</Link>}
              {user.role === "owner" && <Link to="/dashboard">Dashboard</Link>}
              {user.role === "owner" && <Link to="/inbox">Inbox</Link>}
              <Link to="/leases">Leases</Link>
              <span className="nav-user">
                {user.fullName} ({user.role})
              </span>
              <button type="button" className="btn-outline" onClick={() => setConfirmOpen(true)}>
                Log out
              </button>

              <ConfirmDialog
                open={confirmOpen}
                title="Log out of NestFinds?"
                message="You'll need to log in again to see your messages, viewings, and leases."
                confirmLabel="Log out"
                cancelLabel="Stay logged in"
                tone="danger"
                onConfirm={handleConfirmLogout}
                onCancel={() => setConfirmOpen(false)}
              />
            </>
          ) : (
            <>
              <Link to="/login" className="btn-outline">
                Log In
              </Link>
              <Link to="/login?mode=register" className="btn-solid">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}