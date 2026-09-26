"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useSession } from "./session";
import { Arrow } from "./ui";
import { ApprovalModal } from "./approval-modal";
import type { ApprovalDTO } from "@/lib/types";

const PROMPTS = [
  "who's around tonight",
  "find me a dinner",
  "post that I'm free for coffee until 18:00",
];
interface Message {
  id: string;
  who: "me" | "bot";
  text: string;
  approvals?: ApprovalDTO[];
}
/**
 * The concierge as a drawer. It reads the city, replies with names only, and every suggestion
 * that changes something ends in an approval the member answers with World ID. The drawer never
 * performs an action itself.
 */
export function ConciergeDrawer({ city }: { city: string }) {
  const { api, me, config, refresh, notice } = useSession();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [approval, setApproval] = useState<ApprovalDTO | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [log, open]);
  if (!me || !me.membership.active) return null;
  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setDraft("");
    setLog((previous) => [...previous, { id: crypto.randomUUID(), who: "me", text: message }]);
    try {
      const reply = await api<{ reply: string; approvals: ApprovalDTO[]; needsLink: boolean }>(
        "concierge/chat",
        { method: "POST", body: JSON.stringify({ city, message }) },
      );
      setLog((previous) => [
        ...previous,
        { id: crypto.randomUUID(), who: "bot", text: reply.reply, approvals: reply.approvals },
      ]);
    } catch (caught) {
      setLog((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          who: "bot",
          text: caught instanceof Error ? caught.message : "I could not answer that.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="concierge-fab" aria-label="Open concierge" onClick={() => setOpen(true)}>
        <Sparkles size={16} /> Concierge
      </button>
      {open && (
        <>
          <div className="concierge-backdrop" role="presentation" onClick={() => setOpen(false)} />
          <aside className="concierge-drawer" aria-label="Concierge">
            <header>
              <div>
                <strong className="mono">concierge.{config?.ensParent ?? "…"}</strong>
                <p>
                  May write friendship.now and friendship.table only. Every action asks you first.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Close concierge"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="concierge-log">
              {log.length === 0 && (
                <div className="concierge-msg bot">
                  I know who is around, which tables are open, and I can post what you are up for.
                  Nothing happens without your World ID approval.
                </div>
              )}
              {log.map((message) => (
                <div key={message.id} className={"concierge-msg " + message.who}>
                  {message.text}
                  {message.approvals && message.approvals.length > 0 && (
                    <div className="concierge-proposals">
                      {message.approvals.map((item) => (
                        <button
                          key={item.id}
                          className="button lime small"
                          onClick={() => setApproval(item)}
                        >
                          Approve: {item.summary} <Arrow size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <div className="filter-chips" style={{ padding: "0 18px 10px" }}>
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="chip"
                  disabled={busy}
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form
              className="concierge-input"
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask the concierge…"
                aria-label="Message the concierge"
                maxLength={500}
              />
              <button className="button lime small" disabled={busy || !draft.trim()}>
                Send
              </button>
            </form>
          </aside>
        </>
      )}
      <ApprovalModal
        approval={approval}
        onClose={() => setApproval(null)}
        onResolved={(resolved) => {
          setLog((previous) => [
            ...previous,
            {
              id: crypto.randomUUID(),
              who: "bot",
              text:
                resolved.status === "consumed"
                  ? "Done. " + resolved.summary + "."
                  : resolved.status === "denied"
                    ? "You declined, so I did nothing."
                    : "That approval expired, so I did nothing.",
            },
          ]);
          if (resolved.status === "consumed") {
            void refresh();
            notice("Approved. The concierge wrote it with its own key.");
          }
        }}
      />
    </>
  );
}
