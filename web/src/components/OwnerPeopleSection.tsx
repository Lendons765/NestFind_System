import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "../config";
import OwnerNotesModal from "./OwnerNotesModal";

type Person = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  inquiries: number;
  applications: number;
  viewings: number;
  leases: number;
};

export default function OwnerPeopleSection({ token }: { token: string }) {
  const [notesFor, setNotesFor] = useState<{ id: string; name: string } | null>(null);

  const people = useQuery({
    queryKey: ["owner-people", token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/dashboard/owner/people`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      return data as Person[];
    },
  });

  return (
    <section className="inquiry-card">
      <div className="section-head">
        <h2>Tenants connected to your listings</h2>
        <span className="muted">{people.data?.length ?? 0} people</span>
      </div>

      {people.isLoading && <p>Loading…</p>}
      {people.isError && <p className="error">{(people.error as Error).message}</p>}
      {people.data?.length === 0 && (
        <p>No tenants yet. They appear here after an inquiry, application, or viewing.</p>
      )}

      {people.data?.map((p) => (
        <div key={p.id} className="queue-row people-row">
          <div>
            <strong>{p.name}</strong>
            <div className="muted">
              {p.email}
              {p.phone ? ` · ${p.phone}` : ""}
            </div>
          </div>
          <div className="people-counts">
            <span>{p.inquiries} inquiries</span>
            <span>{p.applications} applications</span>
            <span>{p.viewings} viewings</span>
            <span>{p.leases} leases</span>
            <button
              type="button"
              className="btn-clear small-btn"
              onClick={() => setNotesFor({ id: p.id, name: p.name })}
            >
              Notes
            </button>
          </div>
        </div>
      ))}

      <OwnerNotesModal token={token} tenant={notesFor} onClose={() => setNotesFor(null)} />
    </section>
  );
}