import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "./ConfirmDialog";
import { deleteProfile, fetchProfile, saveProfile } from "../api/ownerExtras";

export default function OwnerProfileCard({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["owner-profile", token],
    queryFn: () => fetchProfile(token),
  });

  const [businessName, setBusinessName] = useState("");
  const [unitCount, setUnitCount] = useState("0");
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  // Fill the form once when the profile loads.
  useEffect(() => {
    if (profile.data && !loaded) {
      setBusinessName(profile.data.businessName ?? "");
      setUnitCount(String(profile.data.unitCount));
      setLoaded(true);
    }
  }, [profile.data, loaded]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["owner-profile"] });

  const save = useMutation({
    mutationFn: () =>
      saveProfile(token, {
        businessName: businessName.trim() || null,
        unitCount: Number(unitCount),
      }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: () => deleteProfile(token),
    onSuccess: () => {
      setConfirmDelete(false);
      setBusinessName("");
      setUnitCount("0");
      setLoaded(false);
      refresh();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(unitCount);
    if (!Number.isInteger(n) || n < 0 || n > 10000) {
      setValidation("Unit count must be a whole number from 0 to 10,000.");
      return;
    }
    setValidation(null);
    save.mutate();
  }

  const error = (save.error ?? remove.error) as Error | null;

  return (
    <section className="inquiry-card">
      <div className="section-head">
        <h2>Your business profile</h2>
        <span className="muted">{profile.data?.exists ? "Saved" : "Not set up yet"}</span>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <label>
          Business or display name (optional)
          <input
            maxLength={255}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Juan's Boarding House"
          />
        </label>
        <label>
          Number of units you manage
          <input
            type="number"
            min={0}
            max={10000}
            value={unitCount}
            onChange={(e) => setUnitCount(e.target.value)}
          />
        </label>

        {validation && <p className="error">{validation}</p>}
        {error && <p className="error">{error.message}</p>}

        <div className="card-actions">
          <button type="submit" className="btn-search" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </button>
          {profile.data?.exists && (
            <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete profile
            </button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your profile?"
        message="Your business name and unit count will be removed. Your listings aren't affected."
        confirmLabel="Delete"
        cancelLabel="Keep"
        tone="danger"
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}