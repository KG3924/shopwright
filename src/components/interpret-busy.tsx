import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatBusyElapsed,
  interpretBusyLabel,
  type InterpretBusyKind,
} from "@/lib/ai/interpret-busy";

function useElapsedMs(active: boolean): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) {
      setMs(0);
      return;
    }
    const started = Date.now();
    setMs(0);
    const id = window.setInterval(() => setMs(Date.now() - started), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return ms;
}

export function InterpretBusyStatus({
  kind,
  className,
}: {
  kind: InterpretBusyKind;
  className?: string;
}) {
  const elapsedMs = useElapsedMs(true);
  const label = interpretBusyLabel(kind, elapsedMs);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-interpret-busy={kind}
      data-interpret-phase={label}
      className={cn(
        "overflow-hidden rounded-md border border-accent/30 bg-accent/8",
        className,
      )}
    >
      <div className="interpret-busy-live interpret-busy-bar" aria-hidden />
      <div className="flex items-center gap-3 px-3 py-3">
        <span
          className="interpret-busy-live interpret-busy-spin size-5 shrink-0 rounded-full border-2 border-accent/25 border-t-accent"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-sm font-medium text-fg">{label}</p>
        <p className="font-mono text-xs tabular-nums text-muted">
          {formatBusyElapsed(elapsedMs)}
        </p>
      </div>
    </div>
  );
}
