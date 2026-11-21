import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";

export default function Footer() {
  const { user } = useAuth();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>
            A safer way to rent and to list in Metro Cebu. Verified details, direct messages, and
            digital leases in one place.
          </p>
        </div>

        <div className="footer-col">
          <h3>Explore</h3>
          <Link to="/search">Browse listings</Link>
          <Link to="/#about">About</Link>
          <Link to="/#contact">Contact</Link>
        </div>

        <div className="footer-col">
          <h3>Account</h3>
          {user ? (
            <>
              {user.role === "tenant" && <Link to="/my-home">My home</Link>}
              {user.role === "tenant" && <Link to="/saved">Saved places</Link>}
              {user.role === "owner" && <Link to="/my-listings">My listings</Link>}
              {user.role === "owner" && <Link to="/dashboard">Dashboard</Link>}
              <Link to="/leases">Leases</Link>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/login?mode=register">Create an account</Link>
            </>
          )}
        </div>

        <div className="footer-col">
          <h3>Contact</h3>
          <a href="mailto:hello@nestfind.ph">hello@nestfind.ph</a>
          <span>Metro Cebu, Philippines</span>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {year} NestFinds. All rights reserved.</span>
        <span>Listings are reviewed by our team before they go live.</span>
      </div>
    </footer>
  );
}