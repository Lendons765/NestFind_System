import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { applyToListing } from "../api/leasing";

export default function ApplyPanel({ listingId }: { listingId: string }) {
  const { user, token } = useAuth();
  const [desiredMoveIn, setDesiredMoveIn] = useState("");
  const [term, setTerm] = useState("12");

  const apply = useMutation({
    mutationFn: () =>
      applyToListing(token!, listingId, {
        desiredMoveIn: desiredMoveIn || undefined,
        leaseTermMonths: Number(term),
      }),
  });

  if (!user || !token) {
    return (
      <section className="inquiry-card apply-panel">
        <h2>Apply for this place</h2>
        <p>
          Please <Link to="/login">log in</Link> as a tenant to apply.
        </p>
      </section>
    );
  }
  if (user.role !== "tenant") return null;

  if (apply.isSuccess) {
    return (
      <section className="inquiry-card apply-panel">
        <h2>Application sent</h2>
        <p>
          The owner will review it. Track it on the <Link to="/leases">Leases</Link> page.
        </p>
      </section>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    apply.mutate();
  }

  return (
    <section className="inquiry-card apply-panel">
      <h2>Apply for this place</h2>
      <form className="apply-form" onSubmit={handleSubmit}>
        <label>
          Preferred move-in date
          <input type="date" value={desiredMoveIn} onChange={(e) => setDesiredMoveIn(e.target.value)} />
        </label>
        <label>
          Lease length
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="24">24 months</option>
          </select>
        </label>
        <button type="submit" disabled={apply.isPending}>
          {apply.isPending ? "Sending…" : "Send application"}
        </button>
        {apply.isError && <p className="error">{(apply.error as Error).message}</p>}
      </form>
    </section>
  );
}