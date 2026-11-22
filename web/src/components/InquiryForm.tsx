import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { sendInquiry } from "../api/listings";

export default function InquiryForm({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      sendInquiry(listingId, {
        name: user?.fullName ?? "",
        email: user?.email ?? "",
        message: message.trim(),
        preferredAt: preferredAt || undefined,
      }),
  });

  if (!user) {
    return (
      <div className="inquiry-form">
        <h2>Message the owner</h2>
        <p>
          Please <Link to="/login">log in</Link> to send a message to the owner.
        </p>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div className="inquiry success">
        <strong>Your message was sent to the owner.</strong>
        <p>
          {mutation.data.viewingRequested
            ? "Your viewing request has been recorded."
            : "The owner can now reply to your message."}
        </p>
      </div>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!message.trim()) {
      setError("Please write a message for the owner.");
      return;
    }
    if (message.trim().length > 2000) {
      setError("Keep your message under 2,000 characters.");
      return;
    }
    mutation.mutate();
  }

  return (
    <form className="inquiry-form" onSubmit={handleSubmit} noValidate>
      <h2>Message the owner</h2>

      <label>
        Message
        <textarea
          rows={4}
          maxLength={2000}
          value={message}
          aria-invalid={!!error}
          onChange={(e) => {
            setMessage(e.target.value);
            setError(null);
          }}
        />
        {error && <span className="field-error">{error}</span>}
      </label>

      <label>
        Preferred viewing time (optional)
        <input
          type="datetime-local"
          value={preferredAt}
          onChange={(e) => setPreferredAt(e.target.value)}
        />
      </label>

      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Sending…" : "Send inquiry"}
      </button>

      {mutation.isError && <p className="error">{mutation.error.message}</p>}
    </form>
  );
}