"use client";
import { useState } from "react";
import { useSession } from "./session";
import { Modal, Avatar, ErrorBox, Arrow } from "./ui";
import type { PublicMember } from "@/lib/types";
export function RequestDialog({
  member,
  nowPostId,
  onClose,
}: {
  member: PublicMember | null;
  nowPostId?: string;
  onClose: () => void;
}) {
  const { api, refresh, notice, me } = useSession(),
    [context, setContext] = useState(""),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await api("requests", {
        method: "POST",
        body: JSON.stringify({
          recipientId: member.id,
          context,
          nowPostId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await refresh();
      notice("Request sent. Contact details stay private until you both accept.");
      setContext("");
      onClose();
    } catch (value) {
      setError(value instanceof Error ? value : new Error("Could not send."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!member} title="Start a conversation" onClose={onClose}>
      {member && (
        <form onSubmit={submit}>
          <div className="account-summary">
            <Avatar name={member.name} />
            <div>
              <h3>{member.name}</h3>
              <p className="muted small">{member.role}</p>
            </div>
          </div>
          <label className="field">
            What would you like to connect about?
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              minLength={5}
              maxLength={280}
              required
              placeholder="Coffee after the conference? I'd love to hear what you're building."
              rows={4}
            />
          </label>
          <p className="muted small">
            {me?.membership.remainingRequests ?? 0} requests remaining this access period.
          </p>
          <ErrorBox error={error} />
          <button className="button lime full" disabled={busy}>
            {busy ? "Sending…" : "Send request"}
            <Arrow />
          </button>
        </form>
      )}
    </Modal>
  );
}
