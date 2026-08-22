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
  hint,
  picks,
  className,
}: {
  label: string;
  /** null = unknown axis. Do not pass a resolvePart fallback inch. */
  value: number | null;
  onCommit: (n: number) => void;
  locked?: boolean;
  follows?: string;
  onUnlock?: () => void;
  /** Builder-facing measure source. Catalog fields omit this. */
  hint?: string;
  /** Common-stock chips. Shown only while the axis is unknown (`?`). */
  picks?: readonly number[];
  className?: string;
}) {
  const unknown = value == null;
  const shown = value == null ? "?" : formatInches(value);
  const [raw, setRaw] = useState(value == null ? "?" : String(value));
  useEffect(() => {
    setRaw(value == null ? "?" : String(value));
  }, [value]);

  function commit() {
    const parsed = parseInches(raw);
    if (parsed == null || parsed <= 0) {
      setRaw(value == null ? "?" : String(value));
      return;
    }
    onCommit(parsed);
    setRaw(String(parsed));
  }

  return (
    <div className={cn("block min-w-0", className)}>
      <label className="block min-w-0">
        <span className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-ink-soft">
          <span>
            {label}{" "}
            <span className="tabular-nums text-ink">{shown}</span>
          </span>
          {locked ? (
            <button
              type="button"
              onClick={onUnlock}
              className="text-[10px] text-ink underline-offset-2 hover:underline"
            >
              unlock
            </button>
          ) : unknown ? null : follows && follows !== "fixed" ? (
            <span>follows {follows.toUpperCase()}</span>
          ) : (
            <span>fixed</span>
          )}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-ink-soft">
            {hint}
          </span>
        ) : null}
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
      {unknown && picks?.length ? (
        <span
          className="mt-1 flex flex-wrap gap-1"
          role="group"
          aria-label="Common stock"
        >
          {picks.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onCommit(n)}
              className="h-10 min-w-11 rounded-sm border border-ink/20 bg-paper px-2.5 font-mono text-xs tabular-nums text-ink hover:border-ink/40"
            >
              {formatInches(n)}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );
}
