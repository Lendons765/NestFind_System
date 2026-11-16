import { Link } from "react-router-dom";

// Change the brand name here if it changes.
const BRAND = "NestFinds";

export default function Logo({ large = false }: { large?: boolean }) {
  return (
    <Link to="/" className={large ? "logo logo-large" : "logo"} aria-label={`${BRAND} home`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M4 22 24 6l20 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 21v19h28V21"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <rect x="18" y="27" width="5" height="5" fill="#9ca8a1" />
        <rect x="25" y="27" width="5" height="5" fill="#9ca8a1" />
      </svg>
      <span>{BRAND}</span>
    </Link>
  );
}