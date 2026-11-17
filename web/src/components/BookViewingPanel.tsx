import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { bookViewing } from "../api/tenant";

export default function BookViewingPanel({ listingId }: { listingId: string }) {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");

  const book = useMutation({
    mutationFn: () => bookViewing(token!, listingId, when, notes.trim() || undefined),
    onSuccess: () => {
      setWhen("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["tenant-viewings"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-summary"] });
    },
  });

  if (!user || !token) {
    return (
      <section className="inquiry-card">
        <h2>Book a viewing</h2>
        <p>
          Please <Link to="/login">log in</Link> as a tenant to book a viewing.
        </p>
      </section>
    );
  }
  if (user.role !== "tenant") return null;

  if (book.isSuccess) {
    return (
      <section className="inquiry-card">
        <h2>Viewing requested</h2>
        <p>
          The owner will confirm the time. Track it on <Link to="/my-home">My home</Link>.
        </p>
      </section>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    book.mutate();
  }

  return (
    <section className="inquiry-card">
      <h2>Book a viewing</h2>
      <form className="book-form" onSubmit={handleSubmit}>
        <label>
          Preferred date and time
          <input
            type="datetime-local"
            required
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>
        <label>
          Notes for the owner (optional)
          <textarea
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button type="submit" disabled={book.isPending}>
          {book.isPending ? "Requesting…" : "Request viewing"}
        </button>
        {book.isError && <p className="error">{(book.error as Error).message}</p>}
      </form>
    </section>
  );
}