import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import {
  createListing,
  deleteListingPhoto,
  fetchListingForEdit,
  saveListingEdits,
  uploadListingPhoto,
} from "../api/owner";
import { fetchLocations } from "../api/locations";
import type { ListingPhoto, NewListingInput } from "../type";

const API_BASE = "http://localhost:4000";

type Amenity = "isFurnished" | "hasAircon" | "hasWifi" | "hasParking" | "hasGym";

const amenityOptions: { key: Amenity; label: string }[] = [
  { key: "isFurnished", label: "Furnished" },
  { key: "hasAircon", label: "Air-conditioned" },
  { key: "hasWifi", label: "WiFi" },
  { key: "hasParking", label: "Parking" },
  { key: "hasGym", label: "Gym" },
];

const propertyTypes = [
  { value: "studio", label: "Studio" },
  { value: "boarding_house", label: "Boarding house" },
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "house", label: "House" },
  { value: "other", label: "Other" },
];

interface FormState {
  title: string;
  propertyType: string;
  locationId: string;
  monthlyRent: string;
  bedrooms: string;
  description: string;
  addressLine: string;
  houseRules: string;
  amenities: Record<Amenity, boolean>;
}

const initialState: FormState = {
  title: "",
  propertyType: "studio",
  locationId: "",
  monthlyRent: "",
  bedrooms: "",
  description: "",
  addressLine: "",
  houseRules: "",
  amenities: {
    isFurnished: false,
    hasAircon: false,
    hasWifi: false,
    hasParking: false,
    hasGym: false,
  },
};

function PhotoManager({
  listingId,
  token,
  photos,
}: {
  listingId: string;
  token: string;
  photos: ListingPhoto[];
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["owner-listing"] });

  const upload = useMutation({
    mutationFn: (file: File) => uploadListingPhoto(token, listingId, file),
    onSuccess: () => {
      setPhotoError(null);
      if (inputRef.current) inputRef.current.value = "";
      refresh();
    },
    onError: (err) => setPhotoError((err as Error).message),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => deleteListingPhoto(token, listingId, photoId),
    onSuccess: () => {
      refresh();
    },
  });

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
  }

  return (
    <section className="inquiry-card">
      <h3>Photos ({photos.length}/10)</h3>

      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <figure key={p.id}>
              <img src={`${API_BASE}${p.url}`} alt="Listing photo" />
              <button
                type="button"
                className="secondary"
                disabled={remove.isPending}
                onClick={() => remove.mutate(p.id)}
              >
                Remove
              </button>
            </figure>
          ))}
        </div>
      )}

      <label className="upload">
        Add a photo (JPG, PNG, or WebP, up to 5 MB)
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={upload.isPending || photos.length >= 10}
          onChange={handleFile}
        />
      </label>

      {upload.isPending && <p className="muted">Uploading…</p>}
      {photoError && <p className="error">{photoError}</p>}
    </section>
  );
}

export default function NewListingPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const listing = useQuery({
    queryKey: ["owner-listing", id, token],
    queryFn: () => fetchListingForEdit(token!, id!),
    enabled: isEditing && !!token && user?.role === "owner",
  });

  // Fill the form once, when the listing loads. Later refreshes don't overwrite typing.
  useEffect(() => {
    const d = listing.data;
    if (!d || d.id === loadedId) return;
    setForm({
      title: d.title,
      propertyType: d.property_type,
      locationId: String(d.location_id),
      monthlyRent: String(Number(d.monthly_rent)),
      bedrooms: d.bedrooms === null ? "" : String(d.bedrooms),
      description: d.description ?? "",
      addressLine: d.address_line ?? "",
      houseRules: d.house_rules ?? "",
      amenities: {
        isFurnished: d.is_furnished === 1,
        hasAircon: d.has_aircon === 1,
        hasWifi: d.has_wifi === 1,
        hasParking: d.has_parking === 1,
        hasGym: d.has_gym === 1,
      },
    });
    setLoadedId(d.id);
  }, [listing.data, loadedId]);

  const save = useMutation({
    mutationFn: (input: NewListingInput) =>
      isEditing ? saveListingEdits(token!, id!, input) : createListing(token!, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["owner-listings"] });
      queryClient.invalidateQueries({ queryKey: ["owner-listing"] });
      // A new listing opens its edit page right away, so photos can be added.
      if (!isEditing) navigate(`/my-listings/${result.id}/edit`);
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAmenity(key: Amenity) {
    setForm((prev) => ({
      ...prev,
      amenities: { ...prev.amenities, [key]: !prev.amenities[key] },
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const rent = Number(form.monthlyRent);
    const bedrooms = form.bedrooms === "" ? undefined : Number(form.bedrooms);

    if (!form.title.trim()) {
      setFormError("Enter a title for your listing.");
      return;
    }
    if (!form.locationId) {
      setFormError("Choose a location.");
      return;
    }
    if (!(rent > 0)) {
      setFormError("Enter a monthly rent greater than 0.");
      return;
    }
    if (bedrooms !== undefined && (!Number.isInteger(bedrooms) || bedrooms < 0)) {
      setFormError("Bedrooms must be a whole number.");
      return;
    }

    save.mutate({
      title: form.title.trim(),
      propertyType: form.propertyType,
      locationId: Number(form.locationId),
      monthlyRent: rent,
      bedrooms,
      description: form.description.trim() || undefined,
      addressLine: form.addressLine.trim() || undefined,
      houseRules: form.houseRules.trim() || undefined,
      ...form.amenities,
    });
  }

  if (loading) {
    return <main className="page"><p>Loading…</p></main>;
  }
  if (!token || !user) {
    return (
      <main className="page">
        <p>
          Please <Link to="/login">log in</Link> to manage listings.
        </p>
      </main>
    );
  }
  if (user.role !== "owner") {
    return (
      <main className="page">
        <p>Only owner accounts can manage listings.</p>
      </main>
    );
  }
  if (isEditing && listing.isLoading) {
    return <main className="page"><p>Loading listing…</p></main>;
  }
  if (isEditing && listing.isError) {
    return (
      <main className="page">
        <Link to="/my-listings">← Back to my listings</Link>
        <p className="error">{(listing.error as Error).message}</p>
      </main>
    );
  }

  const current = listing.data;
  const readOnly = isEditing && !!current && current.status !== "draft";

  return (
    <main className="page">
      <Link to="/my-listings">← Back to my listings</Link>
      <h1>{isEditing ? "Edit listing" : "New listing"}</h1>

      {current?.verification === "rejected" && current.rejection_reason && (
        <p className="warning">The admin asked for changes: {current.rejection_reason}</p>
      )}
      {readOnly && (
        <p className="warning">
          This listing is “{current!.status.replace("_", " ")}”, so its details can't be changed right now.
        </p>
      )}

      <fieldset disabled={readOnly} className="fieldset-reset">
        <form className="inquiry-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              required
              value={form.title}
              placeholder="e.g. Studio near IT Park"
              onChange={(e) => set("title", e.target.value)}
            />
          </label>

          <label>
            Property type
            <select value={form.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
              {propertyTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Location
            <select required value={form.locationId} onChange={(e) => set("locationId", e.target.value)}>
              <option value="">Choose a location</option>
              {locations.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.barangay}, {l.city}
                </option>
              ))}
            </select>
            {locations.isError && <span className="error">Could not load locations.</span>}
          </label>

          <label>
            Monthly rent (₱)
            <input
              type="number"
              min="1"
              required
              value={form.monthlyRent}
              onChange={(e) => set("monthlyRent", e.target.value)}
            />
          </label>

          <label>
            Bedrooms (0 for a studio)
            <input
              type="number"
              min="0"
              max="20"
              value={form.bedrooms}
              onChange={(e) => set("bedrooms", e.target.value)}
            />
          </label>

          <div className="checkbox-grid">
            {amenityOptions.map((a) => (
              <label key={a.key} className="check">
                <input
                  type="checkbox"
                  checked={form.amenities[a.key]}
                  onChange={() => toggleAmenity(a.key)}
                />
                {a.label}
              </label>
            ))}
          </div>

          <label>
            Description
            <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </label>

          <label>
            House rules (optional)
            <textarea rows={3} value={form.houseRules} onChange={(e) => set("houseRules", e.target.value)} />
          </label>

          <label>
            Address (optional)
            <input value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
            <span className="muted">Only you, and tenants with a confirmed viewing, can see the address.</span>
          </label>

          <button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isEditing ? "Save changes" : "Save as draft"}
          </button>

          {formError && <p className="error">{formError}</p>}
          {save.isError && <p className="error">{(save.error as Error).message}</p>}
        </form>
      </fieldset>

      {isEditing && current && token && (
        <PhotoManager listingId={current.id} token={token} photos={current.photos} />
      )}

      {!isEditing && <p className="muted">After saving, you can add photos.</p>}
      <p className="muted">
        Saved listings stay hidden until you publish them from My listings.
      </p>
    </main>
  );
}