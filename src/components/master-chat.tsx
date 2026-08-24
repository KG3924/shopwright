import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { askMaster } from "@/lib/ai/master";
import { PACKET_COPY } from "@/lib/plain-copy";
import { useStudio } from "@/lib/store";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export function MasterChat({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const project = useStudio((s) => s.project);
  const zip = useStudio((s) => s.zip);
  const rank = useStudio((s) => s.rank);
  const chat = useStudio((s) => s.chat);
  const addChat = useStudio((s) => s.addChat);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!project || !draft.trim() || busy) return;
    const question = draft.trim();
    setDraft("");
    setError(null);
    addChat({ role: "user", content: question });
    setBusy(true);
    try {
      const result = await askMaster({
        data: {
          question,
          project,
          zip,
          rank,
          history: [...chat, { role: "user", content: question }],
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      addChat({ role: "assistant", content: result.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No answer.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close master"
        className="absolute inset-0 bg-bg/60"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-display text-lg">Master Woodworker</p>
            <p className="text-xs text-muted">
              {PACKET_COPY.masterHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {chat.length === 0 ? (
            <p className="text-sm text-muted">
              Ask how to cut the dados without a table saw, whether walnut is
              worth it at this size, or what changes if the alcove is 62 inches.
            </p>
          ) : null}
          {chat.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={
                m.role === "user"
                  ? "ml-8 rounded-md bg-surface-2 px-3 py-2 text-sm"
                  : "mr-4 text-sm leading-relaxed text-fg/90"
              }
            >
              {m.content}
            </div>
          ))}
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" />
              Looking at the packet…
            </p>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={onSubmit} className="border-t border-border p-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the bench…"
            rows={3}
          />
          <Button className="mt-2 w-full" type="submit" disabled={busy || !draft.trim()}>
            Ask
          </Button>
        </form>
      </aside>
    </div>
  );
}
