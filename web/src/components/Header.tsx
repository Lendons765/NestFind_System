import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="nf-header">
      <Logo />

      <nav>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/search">Browse</Link>
          <Link to="/#about">About</Link>
          <Link to="/#contact">Contact</Link>
        </div>

        <div className="nav-auth">
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              {user.role === "owner" && <Link to="/my-listings">My listings</Link>}
              {user.role === "owner" && <Link to="/inbox">Inbox</Link>}
              {user.role === "admin" && <Link to="/admin">Admin</Link>}
              <span className="nav-user">
                {user.fullName} ({user.role})
              </span>
              <button type="button" className="btn-outline" onClick={handleLogout}>
                Log out
              </button>
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