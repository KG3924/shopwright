import { useEffect, useState } from "react";
import { formatInches, parseInches } from "@/lib/format";
import { cn } from "@/lib/utils";

export function InchField({
  label,
  value,
  onCommit,
  locked,
  follows,
  onUnlock,
  className,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  locked?: boolean;
  follows?: string;
  onUnlock?: () => void;
  className?: string;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  function commit() {
    const parsed = parseInches(raw);
    if (parsed == null || parsed <= 0) {
      setRaw(String(value));
      return;
    }
    onCommit(parsed);
    setRaw(String(parsed));
  }

  return (
    <label className={cn("block min-w-0", className)}>
      <span className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-ink-soft">
        <span>
          {label}{" "}
          <span className="tabular-nums text-ink">{formatInches(value)}</span>
        </span>
        {locked ? (
          <button
            type="button"
            onClick={onUnlock}
            className="text-[10px] text-ink underline-offset-2 hover:underline"
          >
            unlock
          </button>
        ) : follows && follows !== "fixed" ? (
          <span>follows {follows.toUpperCase()}</span>
        ) : (
          <span>fixed</span>
        )}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "mt-1 h-11 w-full rounded-sm border bg-paper px-2 font-mono text-sm tabular-nums text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
          locked ? "border-ink/40" : "border-ink/15",
        )}
        aria-label={label}
      />
    </label>
  );
}
