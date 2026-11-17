import { Link } from "react-router-dom";

// Change the brand name here if it changes.
const BRAND = "NestFinds";

export default function Logo({ large = false }: { large?: boolean }) {
  return (
    <Link to="/" className={large ? "logo logo-large" : "logo"} aria-label={`${BRAND} home`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M6 30 L32 8 L58 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 27 V56 H50 V27"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <rect x="22" y="31" width="8" height="8" rx="1" fill="#a7b1ab" />
        <rect x="34" y="31" width="8" height="8" rx="1" fill="#a7b1ab" />
        <rect x="22" y="43" width="8" height="8" rx="1" fill="#a7b1ab" />
        <rect x="34" y="43" width="8" height="8" rx="1" fill="#a7b1ab" />
      </svg>
      <span>{BRAND}</span>
    </Link>
  );
}