import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendInquiry } from "../api/listings";

type FormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
  preferredAt: string;
};

const emptyForm: FormState = { name: "", email: "", phone: "", message: "", preferredAt: "" };

export default function InquiryForm({ listingId }: { listingId: string }) {
  const [form, setForm] = useState<FormState>(emptyForm);

  const mutation = useMutation({
    mutationFn: () =>
      sendInquiry(listingId, {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        message: form.message,
        preferredAt: form.preferredAt || undefined,
      }),
  });

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
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

  return (
    <form className="inquiry-form" onSubmit={handleSubmit}>
      <h2>Send an inquiry</h2>

      <label>
        Name
        <input
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </label>

      <label>
        Email
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
        />
      </label>

      <label>
        Phone (optional)
        <input
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
        />
      </label>

      <label>
        Message
        <textarea
          required
          rows={4}
          maxLength={2000}
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
        />
      </label>

      <label>
        Preferred viewing time (optional)
        <input
          type="datetime-local"
          value={form.preferredAt}
          onChange={(e) => update("preferredAt", e.target.value)}
        />
      </label>

      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Sending…" : "Send inquiry"}
      </button>

      {mutation.isError && <p className="error">{mutation.error.message}</p>}
    </form>
  );
}