import {
  getSavedPiece,
  listRecentPieces,
  upsertSavedPiece,
  type QuerySql,
} from "./piece-store";
import { shouldWritePiece } from "./saved-pieces";
import type { PieceSummary, SavedPiece } from "./saved-pieces";
import type { Project } from "./types";

export type PieceStoreSource = "pglite" | "neon";

export const SHARED_STORE_REFUSED = {
  ok: false as const,
  reason: "shared-store" as const,
};

/** Mirror of `dbSource`: nonempty DATABASE_URL is shared Neon/Postgres. */
export function pieceStoreSourceFromEnv(
  databaseUrl: string | undefined,
): PieceStoreSource {
  return databaseUrl && databaseUrl.trim() ? "neon" : "pglite";
}

export function localPieceStoreOpen(source: PieceStoreSource): boolean {
  return source === "pglite";
}

type OpenSql = () => Promise<QuerySql>;

/**
 * Auth is deferred. Persistence is local PGLite only.
 * Never open sql on a shared Neon/Postgres path.
 */
export async function listRecentPiecesRpc(
  source: PieceStoreSource,
  openSql: OpenSql,
): Promise<
  { ok: true; pieces: PieceSummary[] } | typeof SHARED_STORE_REFUSED
> {
  if (!localPieceStoreOpen(source)) return SHARED_STORE_REFUSED;
  const sql = await openSql();
  return { ok: true, pieces: await listRecentPieces(sql, 12) };
}

export async function getSavedPieceRpc(
  source: PieceStoreSource,
  openSql: OpenSql,
  id: string,
): Promise<{ ok: true; piece: SavedPiece | null } | typeof SHARED_STORE_REFUSED> {
  if (!localPieceStoreOpen(source)) return SHARED_STORE_REFUSED;
  const sql = await openSql();
  return { ok: true, piece: await getSavedPiece(sql, id) };
}

export async function savePieceRpc(
  source: PieceStoreSource,
  openSql: OpenSql,
  id: string,
  project: Project,
): Promise<
  | { ok: true }
  | { ok: false; skipped: true }
  | typeof SHARED_STORE_REFUSED
> {
  if (!localPieceStoreOpen(source)) return SHARED_STORE_REFUSED;
  if (!shouldWritePiece(project)) return { ok: false, skipped: true };
  const sql = await openSql();
  await upsertSavedPiece(sql, id, project);
  return { ok: true };
}
