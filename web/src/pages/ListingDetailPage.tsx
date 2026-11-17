import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getListing, getListingAddress } from "../api/listings";
import { useAuth } from "../auth/AuthContext";
import InquiryForm from "../components/InquiryForm";
import PhotoGallery from "../components/PhotoGallery";
import ApplyPanel from "../components/ApplyPanel";
import BookViewingPanel from "../components/BookViewingPanel";

const propertyLabels: Record<string, string> = {
  boarding_house: "Boarding house",
  studio: "Studio",
  apartment: "Apartment",
  condo: "Condo",
  house: "House",
  other: "Other",
};

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}/mo`;
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  });

  // Succeeds only for the listing's owner or a tenant with a confirmed viewing.
  // For everyone else the request fails and the default note is shown.
  const address = useQuery({
    queryKey: ["listing-address", id, token],
    queryFn: () => getListingAddress(token!, id!),
    enabled: !!token && !!id,
    retry: false,
  });

  if (isLoading) {
    return <main className="page"><p>Loading listing…</p></main>;
  }

  if (isError) {
    return (
      <main className="page">
        <Link to="/">← Back to search</Link>
        <p className="error">{(error as Error).message}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page">
        <Link to="/">← Back to search</Link>
        <p>This listing is no longer available.</p>
      </main>
    );
  }

  const amenities = [
    data.is_furnished === 1 && "Furnished",
    data.has_aircon === 1 && "Air-conditioned",
    data.has_wifi === 1 && "WiFi",
    data.has_parking === 1 && "Parking",
    data.has_gym === 1 && "Gym",
  ].filter(Boolean) as string[];

  let addressNote: ReactNode;
  if (address.data?.addressLine) {
    addressNote = (
      <>
        <strong>Address:</strong> {address.data.addressLine}
      </>
    );
  } else if (address.data) {
    addressNote = "The owner hasn't added an address yet.";
  } else {
    addressNote = "The exact address is shared once the owner confirms your viewing.";
  }

  return (
    <main className="page">
      <Link to="/">← Back to search</Link>

      <div className="detail">
        <h1>{data.title}</h1>
        {data.verification === "verified" && <span className="verified">✓ Verified listing</span>}
        <p className="muted">
          {data.barangay}, {data.city} · {propertyLabels[data.property_type]}
        </p>
        <p className="price">{formatPeso(data.monthly_rent)}</p>
        <p>
          {data.bedrooms === 0 ? "Studio layout" : `${data.bedrooms ?? "—"} bedroom(s)`}
        </p>

        {amenities.length > 0 && (
          <ul className="amenities">
            {amenities.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}

        {data.description && (
          <section>
            <h2>About this place</h2>
            <p className="description">{data.description}</p>
          </section>
        )}

        {data.house_rules && (
          <section>
            <h2>House rules</h2>
            <p className="description">{data.house_rules}</p>
          </section>
        )}

        <div className="inquiry">{addressNote}</div>
        <PhotoGallery listingId={data.id} />
        <InquiryForm listingId={data.id} />
        <ApplyPanel listingId={data.id} />
        <BookViewingPanel listingId={data.id} />
        {data.walkthroughUrl && (
          <section className="inquiry-card walkthrough">
            <h2>Virtual walkthrough</h2>
            <p className="muted">Take a tour of the place before you visit.</p>
            <a
              href={data.walkthroughUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button-link"
            >
              Open the walkthrough
            </a>
          </section>
        )}
      </div>
    </main>
  );
}