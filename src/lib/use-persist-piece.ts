import { useEffect, useState } from "react";
import { getSavedPiece, listRecentPieces, savePiece } from "./piece-api";
import { shouldWritePiece } from "./saved-pieces";
import { useStudio } from "./store";
import type { PieceSummary } from "./saved-pieces";

export function useRecentPieces(): PieceSummary[] {
  const [pieces, setPieces] = useState<PieceSummary[]>([]);
  useEffect(() => {
    let live = true;
    void listRecentPieces()
      .then((rows) => {
        if (live) setPieces(rows);
      })
      .catch(() => {
        if (live) setPieces([]);
      });
    return () => {
      live = false;
    };
  }, []);
  return pieces;
}

/** Reopen the active piece from the local db, then keep edits saved. */
export function usePersistPiece(): boolean {
  const project = useStudio((s) => s.project);
  const activePieceId = useStudio((s) => s.activePieceId);
  const loadProject = useStudio((s) => s.loadProject);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = useStudio.getState().activePieceId;
    if (!id) {
      setReady(true);
      return;
    }
    void getSavedPiece({ data: { id } })
      .then((piece) => {
        if (cancelled || !piece) return;
        loadProject(piece.project);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadProject]);

  useEffect(() => {
    if (!ready || !project || !activePieceId || !shouldWritePiece(project)) {
      return;
    }
    const timer = window.setTimeout(() => {
      void savePiece({ data: { id: activePieceId, project } }).catch(
        () => undefined,
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [ready, project, activePieceId]);

  useEffect(() => {
    return () => {
      const { project: current, activePieceId: id } = useStudio.getState();
      if (current && id && shouldWritePiece(current)) {
        void savePiece({ data: { id, project: current } }).catch(() => undefined);
      }
    };
  }, []);

  return ready;
}
