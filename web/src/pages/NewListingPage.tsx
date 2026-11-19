import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
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
const MAX_PHOTOS = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

type Amenity = "isFurnished" | "hasAircon" | "hasWifi" | "hasParking" | "hasGym";
type SaveTarget = "stay" | "list";
type FieldKey = "title" | "locationId" | "monthlyRent" | "bedrooms" | "description";

const amenityOptions: { key: Amenity; label: string }[] = [
  { key: "isFurnished", label: "Furnished" },
  { key: "hasAircon", label: "Air-conditioned" },
  { key: "hasWifi", label: "WiFi" },
  { key: "hasParking", label: "Parking" },
  { key: "hasGym", label: "Gym" },
];

const propertyTypes = [
  { value: "studio", label: "Studio", bedrooms: "0", hint: "One room with a private bathroom." },
  {
    value: "boarding_house",
    label: "Boarding house",
    bedrooms: "1",
    hint: "Rooms for students or workers, often with shared facilities.",
  },
  { value: "apartment", label: "Apartment", bedrooms: "2", hint: "A full unit with separate rooms." },
  { value: "condo", label: "Condo", bedrooms: "2", hint: "A unit in a condominium building." },
  { value: "house", label: "House", bedrooms: "3", hint: "A standalone house or townhouse." },
  { value: "other", label: "Other", bedrooms: "", hint: "Anything that doesn't fit the options above." },
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
  bedrooms: "0",
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

function validate(f: FormState): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {};
  const title = f.title.trim();

  if (!title) e.title = "Add a title, such as “Studio near IT Park”.";
  else if (title.length > 255) e.title = "Keep the title under 255 characters.";

  if (!f.locationId) e.locationId = "Choose the barangay where the place is.";

  const rent = Number(f.monthlyRent);
  if (f.monthlyRent === "" || !(rent > 0)) e.monthlyRent = "Enter a monthly rent above ₱0.";
  else if (rent > 10_000_000) e.monthlyRent = "That amount is too high. Check the rent.";

  if (f.bedrooms !== "") {
    const b = Number(f.bedrooms);
    if (!Number.isInteger(b) || b < 0 || b > 20) e.bedrooms = "Use a whole number from 0 to 20.";
  }

  if (f.description.length > 2000) e.description = "Keep the description under 2,000 characters.";

  return e;
}

function toInput(f: FormState): NewListingInput {
  return {
    title: f.title.trim(),
    propertyType: f.propertyType,
    locationId: Number(f.locationId),
    monthlyRent: Number(f.monthlyRent),
    bedrooms: f.bedrooms === "" ? undefined : Number(f.bedrooms),
    description: f.description.trim() || undefined,
    addressLine: f.addressLine.trim() || undefined,
    houseRules: f.houseRules.trim() || undefined,
    ...f.amenities,
  };
}

function formatPeso(value: number | string) {
  return `₱${Number(value).toLocaleString("en-PH")}`;
}

function ListingPreview({
  title,
  rent,
  bedrooms,
  place,
  typeLabel,
  amenities,
  description,
  coverUrl,
}: {
  title: string;
  rent: number;
  bedrooms: string;
  place: string;
  typeLabel: string;
  amenities: string[];
  description: string;
  coverUrl: string | null;
}) {
  const bedroomText =
    bedrooms === "" ? "Bedrooms not stated" : bedrooms === "0" ? "Studio layout" : `${bedrooms} bedroom(s)`;
  const desc = description.trim();

  return (
    <section className="preview-card">
      <p className="preview-label">Preview: how tenants see it</p>
      <div className="preview-photo">
        {coverUrl ? <img src={`${API_BASE}${coverUrl}`} alt="" /> : <span>No photo yet</span>}
      </div>
      <div className="preview-body">
        <h3>{title.trim() || "Your listing title"}</h3>
        <p className="muted">
          {place} · {typeLabel}
        </p>
        <p className="price">{rent > 0 ? `${formatPeso(rent)}/mo` : "Set a rent"}</p>
        <p className="muted">{bedroomText}</p>
        {amenities.length > 0 && (
          <div className="preview-tags">
            {amenities.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
        )}
        {desc && (
          <p className="preview-desc">
            {desc.slice(0, 140)}
            {desc.length > 140 ? "…" : ""}
          </p>
        )}
      </div>
    </section>
  );
}

function Completeness({ items }: { items: { done: boolean; label: string }[] }) {
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);

  return (
    <section className="inquiry-card completeness">
      <div className="owner-card-head">
        <h3>Listing strength</h3>
        <strong>{percent}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <ul className="checklist">
        {items.map((i) => (
          <li key={i.label} className={`check-item${i.done ? " done" : ""}`}>
            <span className="dot" />
            {i.label}
          </li>
        ))}
      </ul>
      {percent < 100 && <p className="muted">Complete listings get more inquiries.</p>}
    </section>
  );
}

/**
 * Photo picker. Works before a draft exists (files stay in memory until save)
 * and after (EditPhotos uploads immediately).
 */
function PhotoPicker({
  pending,
  onAdd,
  onRemove,
  saved,
}: {
  pending: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  saved: ListingPhoto[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = saved.length + pending.length;
  const full = total >= MAX_PHOTOS;

  function addFiles(list: FileList | File[] | null | undefined) {
    if (!list) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      if (!ALLOWED_TYPES.includes(file.type)) rejected.push(`${file.name} isn't JPG, PNG, or WebP`);
      else if (file.size > MAX_BYTES) rejected.push(`${file.name} is over 5 MB`);
      else accepted.push(file);
    }
    const room = MAX_PHOTOS - total;
    const kept = accepted.slice(0, Math.max(room, 0));
    if (accepted.length > kept.length) rejected.push(`Only ${MAX_PHOTOS} photos per listing`);

    setError(rejected.length ? rejected.join(". ") : null);
    if (kept.length) onAdd(kept);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (!full) addFiles(e.dataTransfer.files);
  }

  return (
    <section className="inquiry-card photo-panel">
      <div className="owner-card-head">
        <h3>Photos</h3>
        <span className="muted">
          {total}/{MAX_PHOTOS}
        </span>
      </div>
      <p className="muted">Listings with 3 or more photos get more inquiries. The first photo is the cover.</p>

      {(saved.length > 0 || pending.length > 0) && (
        <div className="photo-grid">
          {saved.map((p, i) => (
            <figure key={p.id}>
              <img src={`${API_BASE}${p.url}`} alt={`Photo ${i + 1}`} />
              {i === 0 && <span className="cover-tag">Cover</span>}
              <span className="photo-state">Saved</span>
            </figure>
          ))}
          {pending.map((file, i) => (
            <figure key={`${file.name}-${i}`}>
              <PendingThumb file={file} />
              {saved.length === 0 && i === 0 && <span className="cover-tag">Cover</span>}
              <span className="photo-state pending">Not saved yet</span>
              <button type="button" className="secondary" onClick={() => onRemove(i)}>
                Remove
              </button>
            </figure>
          ))}
        </div>
      )}

      <label
        className={`photo-drop${dragging ? " over" : ""}${full ? " disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={full}
          onChange={handleChange}
        />
        <span>{full ? "Photo limit reached" : "Drop photos here or click to choose"}</span>
        <small>JPG, PNG, or WebP, up to 5 MB each</small>
      </label>

      {error && <p className="error">{error}</p>}
    </section>
  );
}

function PendingThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url ? <img src={url} alt={file.name} /> : null;
}

export default function NewListingPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(initialState);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const listing = useQuery({
    queryKey: ["owner-listing", id, token],
    queryFn: () => fetchListingForEdit(token!, id!),
    enabled: isEditing && !!token && user?.role === "owner",
  });

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
    setDirty(false);
  }, [listing.data, loadedId]);

  useEffect(() => {
    if (!dirty && pendingPhotos.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pendingPhotos.length]);

  const errors = useMemo(() => validate(form), [form]);
  const visibleErrors = submitted ? errors : {};

  // Uploads queued photos one at a time into the given listing.
  async function uploadQueued(listingId: string, files: File[]) {
    setUploadError(null);
    setUploadProgress({ done: 0, total: files.length });
    let failed: string | null = null;
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadListingPhoto(token!, listingId, files[i]);
        setUploadProgress({ done: i + 1, total: files.length });
      } catch (err) {
        failed = `${files[i].name}: ${(err as Error).message}`;
        break;
      }
    }
    setUploadProgress(null);
    if (failed) setUploadError(`Some photos didn't upload. ${failed}`);
    setPendingPhotos([]);
    queryClient.invalidateQueries({ queryKey: ["owner-listing"] });
    queryClient.invalidateQueries({ queryKey: ["owner-listings"] });
  }

  // Saves the listing as its own request, so a slow photo upload can't block it.
  const save = useMutation({
    mutationFn: (input: NewListingInput) =>
      isEditing ? saveListingEdits(token!, id!, input) : createListing(token!, input),
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function toggleAmenity(key: Amenity) {
    setForm((prev) => ({
      ...prev,
      amenities: { ...prev.amenities, [key]: !prev.amenities[key] },
    }));
    setDirty(true);
  }

  function pickType(value: string) {
    const preset = propertyTypes.find((p) => p.value === value);
    setForm((prev) => ({
      ...prev,
      propertyType: value,
      bedrooms: prev.bedrooms === "" && preset ? preset.bedrooms : prev.bedrooms,
    }));
    setDirty(true);
  }

  async function handleSave(target: SaveTarget) {
    setSubmitted(true);
    setSaveError(null);

    const order: FieldKey[] = ["title", "locationId", "monthlyRent", "bedrooms", "description"];
    const first = order.find((k) => errors[k]);
    if (first) {
      document.getElementById(`field-${first}`)?.focus();
      return;
    }

    try {
      const result = await save.mutateAsync(toInput(form));
      const listingId = isEditing ? id! : (result as { id: string }).id;

      setDirty(false);
      setSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["owner-listings"] });
      queryClient.invalidateQueries({ queryKey: ["owner-listing"] });

      if (pendingPhotos.length > 0) {
        await uploadQueued(listingId, pendingPhotos);
      }

      if (target === "list") {
        navigate("/my-listings");
      } else if (!isEditing) {
        navigate(`/my-listings/${listingId}/edit`, { replace: true });
      }
    } catch (err) {
      setSaveError((err as Error).message);
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
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
  const selectedLocation = locations.data?.find((l) => String(l.id) === form.locationId);
  const place = selectedLocation ? `${selectedLocation.barangay}, ${selectedLocation.city}` : "Barangay not chosen";
  const typeLabel = propertyTypes.find((t) => t.value === form.propertyType)?.label ?? "Property";
  const amenityLabels = amenityOptions.filter((a) => form.amenities[a.key]).map((a) => a.label);
  const savedPhotos = current?.photos ?? [];
  const photoCount = savedPhotos.length + pendingPhotos.length;
  const rent = Number(form.monthlyRent) || 0;
  const yearly = rent > 0 ? rent * 12 : 0;
  const descLength = form.description.trim().length;
  const hasErrors = Object.keys(errors).length > 0;

  const strength = [
    { done: form.title.trim().length >= 5, label: "A clear title (5+ characters)" },
    { done: !!form.locationId, label: "Barangay chosen" },
    { done: rent > 0, label: "Monthly rent set" },
    { done: form.bedrooms !== "", label: "Bedrooms stated" },
    { done: amenityLabels.length >= 2, label: "At least 2 amenities" },
    { done: descLength >= 80, label: "Description of 80+ characters" },
    { done: photoCount >= 3, label: "3 or more photos" },
  ];

  const saveLabel = save.isPending
    ? "Saving…"
    : isEditing
      ? "Save changes"
      : pendingPhotos.length > 0
        ? `Save and upload ${pendingPhotos.length} photo(s)`
        : "Save";

  return (
    <main className="page listing-page">
      <Link to="/my-listings">← Back to my listings</Link>

      <div className="listing-head">
        <h1>{isEditing ? "Edit listing" : "New listing"}</h1>
        {current && (
          <span className={current.status === "draft" ? "pill pill-draft" : "pill pill-live"}>
            {current.status === "draft" ? "Draft" : current.status === "active" ? "Live" : current.status}
          </span>
        )}
      </div>

      {current?.verification === "rejected" && current.rejection_reason && (
        <p className="warning">Changes requested: {current.rejection_reason}</p>
      )}
      {readOnly && <p className="warning">This listing is live, so its details are locked.</p>}

      <div className="listing-layout">
        <form
          className="listing-form"
          noValidate
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            handleSave("stay");
          }}
        >
          <fieldset disabled={readOnly} className="fieldset-reset">
            <section className="form-section">
              <h2>The basics</h2>

              <div className="field">
                <label htmlFor="field-title">Title</label>
                <input
                  id="field-title"
                  value={form.title}
                  maxLength={255}
                  placeholder="e.g. Studio near IT Park"
                  aria-invalid={!!visibleErrors.title}
                  onChange={(e) => set("title", e.target.value)}
                />
                {visibleErrors.title && <span className="field-error">{visibleErrors.title}</span>}
              </div>

              <div className="field">
                <span className="field-caption">Property type</span>
                <div className="type-chips" role="group" aria-label="Property type">
                  {propertyTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`type-chip${form.propertyType === t.value ? " active" : ""}`}
                      aria-pressed={form.propertyType === t.value}
                      onClick={() => pickType(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <span className="muted">{propertyTypes.find((t) => t.value === form.propertyType)?.hint}</span>
              </div>

              <div className="field">
                <label htmlFor="field-locationId">Barangay</label>
                <select
                  id="field-locationId"
                  value={form.locationId}
                  aria-invalid={!!visibleErrors.locationId}
                  disabled={locations.isLoading || locations.isError}
                  onChange={(e) => set("locationId", e.target.value)}
                >
                  <option value="">{locations.isLoading ? "Loading barangays…" : "Choose a barangay"}</option>
                  {locations.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.barangay}, {l.city}
                    </option>
                  ))}
                </select>
                {locations.isError && (
                  <span className="field-error">
                    Couldn't load barangays.{" "}
                    <button type="button" className="link-btn" onClick={() => locations.refetch()}>
                      Try again
                    </button>
                  </span>
                )}
                {visibleErrors.locationId && <span className="field-error">{visibleErrors.locationId}</span>}
              </div>
            </section>

            <section className="form-section">
              <h2>Price and size</h2>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="field-monthlyRent">Monthly rent (₱)</label>
                  <input
                    id="field-monthlyRent"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={form.monthlyRent}
                    aria-invalid={!!visibleErrors.monthlyRent}
                    onChange={(e) => set("monthlyRent", e.target.value)}
                  />
                  {visibleErrors.monthlyRent ? (
                    <span className="field-error">{visibleErrors.monthlyRent}</span>
                  ) : yearly > 0 ? (
                    <span className="muted">About {formatPeso(yearly)} a year</span>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="field-bedrooms">Bedrooms</label>
                  <input
                    id="field-bedrooms"
                    type="number"
                    min="0"
                    max="20"
                    value={form.bedrooms}
                    aria-invalid={!!visibleErrors.bedrooms}
                    onChange={(e) => set("bedrooms", e.target.value)}
                  />
                  {visibleErrors.bedrooms && <span className="field-error">{visibleErrors.bedrooms}</span>}
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>Amenities</h2>
              <div className="amenity-chips">
                {amenityOptions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={`amenity-chip${form.amenities[a.key] ? " on" : ""}`}
                    aria-pressed={form.amenities[a.key]}
                    onClick={() => toggleAmenity(a.key)}
                  >
                    {form.amenities[a.key] ? "✓ " : ""}
                    {a.label}
                  </button>
                ))}
              </div>
              <span className="muted">Tenants filter by these, so tick everything that applies.</span>
            </section>

            <section className="form-section">
              <h2>Describe the place</h2>
              <div className="field">
                <label htmlFor="field-description">Description</label>
                <textarea
                  id="field-description"
                  rows={5}
                  value={form.description}
                  aria-invalid={!!visibleErrors.description}
                  onChange={(e) => set("description", e.target.value)}
                />
                <div className="field-meta">
                  {visibleErrors.description ? (
                    <span className="field-error">{visibleErrors.description}</span>
                  ) : (
                    <span className="muted">Tip: mention the nearest landmark, transport, and what's included.</span>
                  )}
                  <span className={`char-count${form.description.length > 2000 ? " over" : ""}`}>
                    {form.description.length}/2000
                  </span>
                </div>
              </div>

              <div className="field">
                <label htmlFor="field-houseRules">House rules (optional)</label>
                <textarea
                  id="field-houseRules"
                  rows={3}
                  value={form.houseRules}
                  onChange={(e) => set("houseRules", e.target.value)}
                />
              </div>
            </section>

            <section className="form-section">
              <h2>Address</h2>
              <div className="field">
                <label htmlFor="field-addressLine">Street address (optional)</label>
                <input
                  id="field-addressLine"
                  value={form.addressLine}
                  onChange={(e) => set("addressLine", e.target.value)}
                />
                <span className="muted">Kept private. Tenants see it only after a confirmed viewing.</span>
              </div>
            </section>

            {!isEditing && (
              <section className="form-section">
                <h2>Photos</h2>
                <PhotoPicker
                  pending={pendingPhotos}
                  saved={[]}
                  onAdd={(files) => setPendingPhotos((prev) => [...prev, ...files])}
                  onRemove={(i) => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </section>
            )}
          </fieldset>

          {!readOnly && (
            <>
              {submitted && hasErrors && <p className="error">Fix the highlighted fields to save.</p>}
              {uploadProgress && (
                <p className="muted">
                  Uploading photo {uploadProgress.done + 1} of {uploadProgress.total}…
                </p>
              )}
              {uploadError && <p className="error">{uploadError}</p>}

              <div className="save-bar">
                {saveError && <p className="error">{saveError}</p>}
                {isEditing && savedAt && !dirty && !save.isPending && !saveError && (
                  <span className="saved-note">
                    Saved at {savedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={save.isPending}
                  onClick={() => handleSave("list")}
                >
                  Save and return
                </button>
                <button type="submit" disabled={save.isPending}>
                  {saveLabel}
                </button>
              </div>
            </>
          )}
        </form>

        <aside className="listing-side">
          <ListingPreview
            title={form.title}
            rent={rent}
            bedrooms={form.bedrooms}
            place={place}
            typeLabel={typeLabel}
            amenities={amenityLabels}
            description={form.description}
            coverUrl={savedPhotos[0]?.url ?? null}
          />

          <Completeness items={strength} />

          {isEditing && current && token ? (
            <EditPhotos listingId={current.id} token={token} photos={savedPhotos} />
          ) : null}
        </aside>
      </div>
    </main>
  );
}

/**
 * Photo manager for an existing draft: uploads each chosen file right away.
 */
function EditPhotos({
  listingId,
  token,
  photos,
}: {
  listingId: string;
  token: string;
  photos: ListingPhoto[];
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["owner-listing"] });

  const remove = useMutation({
    mutationFn: (photoId: string) => deleteListingPhoto(token, listingId, photoId),
    onSuccess: refresh,
  });

  async function uploadAll(files: File[]) {
    setError(null);
    for (const file of files) {
      try {
        await uploadListingPhoto(token, listingId, file);
      } catch (err) {
        setError(`${file.name}: ${(err as Error).message}`);
        break;
      }
    }
    setPending([]);
    refresh();
  }

  return (
    <>
      <PhotoPicker
        pending={pending}
        saved={photos}
        onAdd={(files) => {
          setPending((prev) => [...prev, ...files]);
          uploadAll(files);
        }}
        onRemove={() => {}}
      />
      {error && <p className="error">{error}</p>}
      {remove.isError && <p className="error">{(remove.error as Error).message}</p>}
    </>
  );
}