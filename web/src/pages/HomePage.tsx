import { useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicStats } from "../api/dashboard";
import { useAuth } from "../auth/AuthContext";
import { useState } from "react";
import Logo from "../components/Logo";
import BrowseSection from "../components/BrowseSection";
import HeroBackdrop from "../components/HeroBackdrop";

const propertyOptions = [
  { value: "", label: "All Types" },
  { value: "boarding_house", label: "Boarding house" },
  { value: "studio", label: "Studio" },
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "house", label: "House" },
];

const icons = {
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  ),
  sliders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </svg>
  ),
  verified: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  affordable: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 7c-2 2-3 4-3 7a7 7 0 0 0 14 0c0-3-1-5-3-7" />
      <path d="M9 7l3-3 3 3" />
      <text x="12" y="16" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">₱</text>
    </svg>
  ),
  student: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3 19c0-3 3-5 6-5s6 2 6 5" />
      <path d="M14 19c0-2 1.5-3.5 3.5-3.5S21 17 21 19" />
    </svg>
  ),
  secure: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
      <rect x="9.5" y="11" width="5" height="4.5" rx="0.8" />
      <path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11" />
    </svg>
  ),
};

const roleLines: Record<string, { line: string; actions: { to: string; label: string }[] }> = {
  tenant: {
    line: "Here's where your search, messages, and move-in live.",
    actions: [
      { to: "/search", label: "Browse listings" },
      { to: "/my-home", label: "My home" },
      { to: "/saved", label: "Saved places" },
      { to: "/leases", label: "Leases" },
    ],
  },
  owner: {
    line: "Your listings, inquiries, and applicants are all in one place.",
    actions: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/my-listings", label: "My listings" },
      { to: "/my-listings/new", label: "New listing" },
      { to: "/inbox", label: "Inbox" },
    ],
  },
};

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="stat">
      <div className="stat-value">{value ?? "–"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { user, loading } = useAuth();
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");

  const stats = useQuery({
    queryKey: ["public-stats"],
    queryFn: fetchPublicStats,
  });

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (location.trim()) params.set("q", location.trim());
    if (propertyType) params.set("propertyType", propertyType);
    navigate(`/search?${params.toString()}`);
  }

  // Shared browse section, shown on both the greeting and the visitor homepage.
  const browseBlock = (
    <section id="browse" className="home-browse">
      <div className="home-browse-head">
        <h2>Browse all listings</h2>
        <Link to="/search">Open full search →</Link>
      </div>
      <BrowseSection />
    </section>
  );

  if (!loading && user) {
    const firstName = user.fullName.split(" ")[0];
    const copy = roleLines[user.role] ?? roleLines.tenant;

    return (
      <main className="landing">
        <section className="greeting-hero">
          <HeroBackdrop />
          <p className="greeting-kicker">{timeOfDayGreeting()}</p>
          <h1 className="greeting-title">Welcome, {firstName}</h1>
          <p className="greeting-line">{copy.line}</p>

          <form className="landing-search greeting-search" onSubmit={handleSearch}>
            <span className="search-icon">{icons.pin}</span>
            <input
              className="search-input"
              aria-label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Search location (e.g. Cebu City, Lapu-Lapu, etc.)"
            />
            <span className="search-divider" />
            <div className="type-field">
              <span className="type-icon">{icons.sliders}</span>
              <select
                aria-label="Property type"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
              >
                {propertyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="type-chevron">{icons.chevron}</span>
            </div>
            <button type="submit" className="search-submit" aria-label="Search">
              {icons.search}
            </button>
          </form>

          <div className="greeting-actions">
            {copy.actions.map((a) => (
              <Link key={a.to} to={a.to} className="greeting-chip">
                {a.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="stats">
          <Stat label="Live listings" value={stats.data?.live_listings} />
          <Stat label="Barangays covered" value={stats.data?.barangays} />
          <Stat label="Property owners" value={stats.data?.owners} />
          <Stat label="Tenants" value={stats.data?.tenants} />
        </section>
      </main>
    );
  }

  return (
    <main className="landing">
      <section className="landing-hero">
        <HeroBackdrop />
        <div className="landing-content">
          <Logo large />

          <h1 className="tagline">
            Find your next home,
            <br />
            one click closer.
          </h1>
          <p className="subtagline">
            Safe. Verified. Affordable.
            <br />
            Student and boarding house rentals, made easier.
          </p>

          <form className="landing-search" onSubmit={handleSearch}>
            <span className="search-icon">{icons.pin}</span>
            <input
              className="search-input"
              aria-label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Search location (e.g. Cebu City, Lapu-Lapu, etc.)"
            />
            <span className="search-divider" />
            <div className="type-field">
              <span className="type-icon">{icons.sliders}</span>
              <select
                aria-label="Property type"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
              >
                {propertyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="type-chevron">{icons.chevron}</span>
            </div>
            <button type="submit" className="search-submit" aria-label="Search">
              {icons.search}
            </button>
          </form>

          <ul className="feature-row">
            <li>
              {icons.verified}
              <span>Verified<br />Listings</span>
            </li>
            <li>
              {icons.affordable}
              <span>Affordable<br />Options</span>
            </li>
            <li>
              {icons.student}
              <span>Student<br />Friendly</span>
            </li>
            <li>
              {icons.secure}
              <span>Safe &amp;<br />Secure</span>
            </li>
          </ul>
        </div>

        <p className="script-note">
          More than just a place,
          <br />
          it's your nest.
        </p>
      </section>

      <section className="stats">
        <Stat label="Live listings" value={stats.data?.live_listings} />
        <Stat label="Barangays covered" value={stats.data?.barangays} />
        <Stat label="Property owners" value={stats.data?.owners} />
        <Stat label="Tenants" value={stats.data?.tenants} />
      </section>

      {browseBlock}

      <section id="about" className="landing-section">
        <h2>About NestFinds</h2>
        <p>
          NestFinds connects students, young professionals, and families with independent
          property owners across Cebu. Every listing is reviewed by our team before it goes
          live, and the exact address is shared only after the owner confirms a viewing.
        </p>
      </section>

      <section id="contact" className="landing-section">
        <h2>Contact</h2>
        <p>
          Questions about listing your property or finding a place? Email{" "}
          <a href="mailto:hello@nestfind.ph">hello@nestfind.ph</a>.
        </p>
      </section>
    </main>
  );
}