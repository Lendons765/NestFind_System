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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      sendInquiry(listingId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
        preferredAt: form.preferredAt || undefined,
      }),
  });

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear the message for a field as soon as the user starts fixing it.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Please enter a valid email, such as name@example.com.";
    }
    if (!form.message.trim()) next.message = "Please write a message for the owner.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
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
    <form className="inquiry-form" onSubmit={handleSubmit} noValidate>
      <h2>Send an inquiry</h2>

      <label>
        Name
        <input
          value={form.name}
          aria-invalid={!!errors.name}
          onChange={(e) => update("name", e.target.value)}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>

      <label>
        Email
        <input
          type="email"
          value={form.email}
          aria-invalid={!!errors.email}
          onChange={(e) => update("email", e.target.value)}
        />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </label>

      <label>
        Phone (optional)
        <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
      </label>

      <label>
        Message
        <textarea
          rows={4}
          maxLength={2000}
          value={form.message}
          aria-invalid={!!errors.message}
          onChange={(e) => update("message", e.target.value)}
        />
        {errors.message && <span className="field-error">{errors.message}</span>}
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