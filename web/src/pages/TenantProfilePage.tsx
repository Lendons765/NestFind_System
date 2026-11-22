import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchTenantAccount, updateTenantAccount } from "../api/tenant";
import { fetchAccount, updateAccount } from "../api/ownerExtras";

export default function TenantProfilePage() {
  const { user, token, loading, adoptSession } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = user?.role === "owner";
  const isTenant = user?.role === "tenant";

  const account = useQuery({
    queryKey: ["profile-account", user?.role, token],
    queryFn: () => (isOwner ? fetchAccount(token!) : fetchTenantAccount(token!)),
    enabled: !!token && (isOwner || isTenant),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Fill the form once when the account loads, so background refreshes don't overwrite typing.
  useEffect(() => {
    if (account.data && !loaded) {
      setFullName(account.data.fullName);
      setPhone(account.data.phone ?? "");
      setLoaded(true);
    }
  }, [account.data, loaded]);

  const save = useMutation({
    mutationFn: () => {
      const input = { fullName: fullName.trim(), phone: phone.trim() || null };
      return isOwner ? updateAccount(token!, input) : updateTenantAccount(token!, input);
    },
    onSuccess: () => {
      // Keep the header name in sync without a page reload.
      if (token && user) adoptSession(token, { ...user, fullName: fullName.trim() });
      queryClient.invalidateQueries({ queryKey: ["profile-account"] });
    },
  });

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!token || !user) {
    return (
      <main className="page">
        <p>Please <Link to="/login">log in</Link> to see your profile.</p>
      </main>
    );
  }
  if (!isOwner && !isTenant) {
    return (
      <main className="page">
        <p>Profiles are available for tenant and owner accounts.</p>
      </main>
    );
  }

  const a = account.data;

  return (
    <main className="page tenant-home">
      <div className="owner-toolbar">
        <h1>My profile</h1>
        <Link to={isOwner ? "/dashboard" : "/my-home"} className="button-link">
          {isOwner ? "Back to dashboard" : "Back to My home"}
        </Link>
      </div>

      {account.isLoading && <p>Loading your profile…</p>}
      {account.isError && <p className="error">{(account.error as Error).message}</p>}

      {a && (
        <>
          <section className="inquiry-card profile-summary">
            <div className="profile-avatar" aria-hidden="true">
              {a.fullName.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <h2>{a.fullName}</h2>
              <p className="muted">{a.email}</p>
              <p className="muted">
                {isOwner ? "Owner" : "Tenant"} · Member since{" "}
                {new Date(a.createdAt).toLocaleDateString("en-PH", { dateStyle: "medium" })}
              </p>
            </div>
          </section>

          <section className="inquiry-card">
            <h2>Edit details</h2>
            <form
              className="profile-form"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (fullName.trim()) save.mutate();
              }}
            >
              <label>
                Full name
                <input maxLength={255} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label>
                Email (read-only)
                <input value={a.email} disabled />
              </label>
              <label>
                Phone (optional)
                <input maxLength={32} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>

              {save.isError && <p className="error">{(save.error as Error).message}</p>}
              {save.isSuccess && <p className="muted">Saved.</p>}

              <div className="card-actions">
                <button
                  type="submit"
                  className="btn-search"
                  disabled={save.isPending || !fullName.trim()}
                >
                  {save.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}