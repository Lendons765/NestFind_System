import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchOwnerInquiries, updateViewingStatus } from "../api/owner";
import type { OwnerInquiry, OwnerViewing } from "../types";

type Decision = "confirmed" | "cancelled";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function ViewingRow({
  viewing,
  busy,
  onDecide,
}: {
  viewing: OwnerViewing;
  busy: boolean;
  onDecide: (viewingId: string, status: Decision) => void;
}) {
  return (
    <div className="viewing-row">
      <span>
        Preferred time: {formatDate(viewing.scheduledAt)} · <strong>{viewing.status}</strong>
      </span>
      {viewing.status === "requested" && (
        <div className="viewing-actions">
          <button type="button" disabled={busy} onClick={() => onDecide(viewing.id, "confirmed")}>
            Accept
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => onDecide(viewing.id, "cancelled")}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

function InquiryCard({
  item,
  busy,
  onDecide,
}: {
  item: OwnerInquiry;
  busy: boolean;
  onDecide: (viewingId: string, status: Decision) => void;
}) {
  return (
    <section className="inquiry-card">
      <h3>{item.listingTitle}</h3>
      <p className="muted">
        From {item.tenant.name} · {item.tenant.email}
        {item.tenant.phone ? ` · ${item.tenant.phone}` : ""}
      </p>
      <p className="muted">Received {formatDate(item.createdAt)}</p>

      <div className="thread">
        {item.messages.map((m, i) => (
          <div key={i} className="bubble">
            <strong>{m.senderName}</strong>
            <p>{m.body}</p>
          </div>
        ))}
      </div>

      {item.viewings.length > 0 && (
        <div className="viewings">
          <h4>Viewing requests</h4>
          {item.viewings.map((v) => (
            <ViewingRow key={v.id} viewing={v} busy={busy} onDecide={onDecide} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function OwnerInboxPage() {
  const { user, token, loading } = useAuth();
  const queryClient = useQueryClient();

  const inquiries = useQuery({
    queryKey: ["owner-inquiries", token],
    queryFn: () => fetchOwnerInquiries(token!),
    enabled: !!token && user?.role === "owner",
  });

  const decide = useMutation({
    mutationFn: ({ viewingId, status }: { viewingId: string; status: Decision }) =>
      updateViewingStatus(token!, viewingId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-inquiries"] });
    },
  });

  function handleDecide(viewingId: string, status: Decision) {
    decide.mutate({ viewingId, status });
  }

  if (loading) {
    return <main className="page"><p>Loading…</p></main>;
  }
  if (!token || !user) {
    return (
      <main className="page">
        <p>
          Please <Link to="/login">log in</Link> to see your inbox.
        </p>
      </main>
    );
  }
  if (user.role !== "owner") {
    return (
      <main className="page">
        <p>The inbox is only available to owner accounts.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Inbox</h1>

      {inquiries.isLoading && <p>Loading inquiries…</p>}
      {inquiries.isError && <p className="error">{(inquiries.error as Error).message}</p>}
      {inquiries.data?.length === 0 && <p>No inquiries yet.</p>}
      {decide.isError && <p className="error">{(decide.error as Error).message}</p>}

      <div className="inbox">
        {inquiries.data?.map((item) => (
          <InquiryCard
            key={item.conversationId}
            item={item}
            busy={decide.isPending}
            onDecide={handleDecide}
          />
        ))}
      </div>
    </main>
  );
}