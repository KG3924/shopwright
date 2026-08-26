import { safeThumbnailSrc, type PieceSummary } from "@/lib/saved-pieces";

export function RecentPieces({
  pieces,
  onOpen,
  busy,
}: {
  pieces: PieceSummary[];
  onOpen: (id: string) => void;
  busy?: boolean;
}) {
  if (!pieces.length) return null;
  return (
    <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pieces.map((piece) => {
        const thumb = safeThumbnailSrc(piece.thumbnail);
        return (
          <li key={piece.id}>
            <button
              type="button"
              data-recent-piece={piece.id}
              disabled={busy}
              onClick={() => onOpen(piece.id)}
              className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-[var(--shadow-bench)] transition-colors duration-200 hover:border-border-strong disabled:opacity-40"
            >
              <span className="relative aspect-[4/3] overflow-hidden bg-surface-2">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="block size-full bg-surface-2" />
                )}
                <span className="absolute left-2 top-2 rounded-sm bg-surface/90 px-2 py-1 text-[10px] uppercase tracking-wider text-ink">
                  {piece.sourceKind === "catalog" ? "Example packet" : "Interpretation"}
                </span>
              </span>
              <span className="flex flex-1 flex-col p-4">
                <span className="font-display text-lg">{piece.name}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
