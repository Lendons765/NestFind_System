import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getListing, getListingAddress } from "../api/listings";
import { useAuth } from "../auth/AuthContext";
import InquiryForm from "../components/InquiryForm";
import PhotoGallery from "../components/PhotoGallery";
import ApplyPanel from "../components/ApplyPanel";
import BookViewingPanel from "../components/BookViewingPanel";
import Modal from "../components/Modal";

type ModalKind = "inquiry" | "apply" | "viewing";

const propertyLabels: Record<string, string> = {
  boarding_house: "Boarding house",
  studio: "Studio",
  apartment: "Apartment",
  condo: "Condo",
  house: "House",
  other: "Other",
};

function formatAmount(value: string | number) {
  return `₱${Number(value).toLocaleString("en-PH")}`;
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [modal, setModal] = useState<ModalKind | null>(null);

  const isOwner = user?.role === "owner";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  });

  // Succeeds only for the listing's owner or a tenant with a confirmed viewing.
  const address = useQuery({
    queryKey: ["listing-address", id, token],
    queryFn: () => getListingAddress(token!, id!),
    enabled: !!token && !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <main className="ld-page">
        <p className="ld-status">Loading listing…</p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="ld-page">
        <Link to="/search" className="ld-crumb">← Back to search</Link>
        <p className="ld-status error">{(error as Error).message}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="ld-page">
        <Link to="/search" className="ld-crumb">← Back to search</Link>
        <p className="ld-status">This listing is no longer available.</p>
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

  const layout =
    data.bedrooms === 0 ? "Studio layout" : `${data.bedrooms ?? "—"} bedroom(s)`;

  let addressNote: ReactNode;
  if (address.data?.addressLine) {
    addressNote = (
      <>
        <span className="ld-address-label">Address</span>
        <span className="ld-address-value">{address.data.addressLine}</span>
      </>
    );
  } else if (address.data) {
    addressNote = "The owner hasn't added an address yet.";
  } else {
    addressNote = "The exact address is shared once the owner confirms your viewing.";
  }

  return (
    <main className="ld-page">
      {isOwner && (
        <div className="warning">
          You're previewing this listing the way tenants see it. Tenant actions are turned off for owner accounts.
        </div>
      )}

      <Link to="/search" className="ld-crumb">← Back to search</Link>

      <div className="ld-grid">
        <div className="ld-main">
          <section className="ld-card ld-hero">
            <div className="ld-badges">
              {data.verification === "verified" && (
                <span className="ld-badge verified">✓ Verified listing</span>
              )}
              <span className="ld-badge">{propertyLabels[data.property_type]}</span>
            </div>

            <h1>{data.title}</h1>
            <p className="ld-location">
              {data.barangay}, {data.city}
            </p>

            <div className="ld-facts">
              <div className="ld-fact">
                <span>Layout</span>
                <strong>{layout}</strong>
              </div>
              <div className="ld-fact">
                <span>Type</span>
                <strong>{propertyLabels[data.property_type]}</strong>
              </div>
              <div className="ld-fact">
                <span>Views</span>
                <strong>{data.view_count ?? "—"}</strong>
              </div>
            </div>

            {amenities.length > 0 && (
              <ul className="ld-amenities">
                {amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </section>

          {data.description && (
            <section className="ld-card">
              <h2>About this place</h2>
              <p className="ld-text">{data.description}</p>
            </section>
          )}

          {data.house_rules && (
            <section className="ld-card">
              <h2>House rules</h2>
              <p className="ld-text">{data.house_rules}</p>
            </section>
          )}

          <section className="ld-card">
            <h2>Photos</h2>
            <PhotoGallery listingId={data.id} />
          </section>

          {data.walkthroughUrl && (
            <section className="ld-card ld-walkthrough">
              <div>
                <h2>Virtual walkthrough</h2>
                <p className="ld-text">Take a tour of the place before you visit.</p>
              </div>
              <a
                href={data.walkthroughUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ld-btn primary"
              >
                Open the walkthrough
              </a>
            </section>
          )}
        </div>

        <aside className="ld-aside">
          <div className="ld-card ld-action-card">
            <p className="ld-price-label">Monthly rent</p>
            <p className="ld-price">
              {formatAmount(data.monthly_rent)}
              <span>/mo</span>
            </p>

            {isOwner ? (
              <p className="muted">
                Tenants can message, apply, and book viewings from this page. Owners can't.
              </p>
            ) : (
              <div className="ld-actions">
                <button type="button" className="ld-btn primary" onClick={() => setModal("inquiry")}>
                  Message owner
                </button>
                <button type="button" className="ld-btn" onClick={() => setModal("apply")}>
                  Apply for this place
                </button>
                <button type="button" className="ld-btn" onClick={() => setModal("viewing")}>
                  Book a viewing
                </button>
              </div>
            )}

            <div className="ld-address">{addressNote}</div>
          </div>
        </aside>
      </div>

      <Modal open={modal === "inquiry"} title="Message the owner" onClose={() => setModal(null)}>
        <InquiryForm listingId={data.id} />
      </Modal>

      <Modal open={modal === "apply"} title="Apply for this place" onClose={() => setModal(null)}>
        <ApplyPanel listingId={data.id} />
      </Modal>

      <Modal open={modal === "viewing"} title="Book a viewing" onClose={() => setModal(null)}>
        <BookViewingPanel listingId={data.id} />
      </Modal>
    </main>
  );
}