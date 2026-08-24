export type InterpretBusyKind = "photo" | "url";

/** Time-based phases — the server fn is one round-trip, so this is UX only. */
const URL_FETCH_MS = 4_000;
const URL_READ_MS = 12_000;
const PHOTO_READ_MS = 8_000;

export function interpretBusyLabel(
  kind: InterpretBusyKind,
  elapsedMs: number,
): string {
  if (kind === "url") {
    if (elapsedMs < URL_FETCH_MS) return "Fetching link…";
    if (elapsedMs < URL_READ_MS) return "Reading photos…";
    return "Building packet…";
  }
  if (elapsedMs < PHOTO_READ_MS) return "Reading photos…";
  return "Building packet…";
}

export function formatBusyElapsed(elapsedMs: number): string {
  const sec = Math.max(0, Math.floor(elapsedMs / 1000));
  return `${sec}s`;
}
