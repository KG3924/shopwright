import {
  asIso,
  parseStoredProject,
  thumbnailFromProject,
  type PieceSummary,
  type SavedPiece,
} from "./saved-pieces";
import type { Project } from "./types";

/** Minimal SQL surface — matches `@/lib/db` `.query()` without pulling the client. */
export type QuerySql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

type PieceRow = {
  id: string;
  name: string;
  source_kind: string;
  project?: unknown;
  thumbnail?: string | null;
  updated_at?: unknown;
};

function asSourceKind(value: string): Project["sourceKind"] {
  if (value === "photo" || value === "url" || value === "blueprint" || value === "catalog") {
    return value;
  }
  return "photo";
}

export async function upsertSavedPiece(
  sql: QuerySql,
  id: string,
  project: Project,
): Promise<void> {
  const payload = JSON.stringify(project);
  await sql.query(
    `insert into pieces (id, name, source_kind, project)
     values ($1, $2, $3, $4::jsonb)
     on conflict (id) do update set
       name = excluded.name,
       source_kind = excluded.source_kind,
       project = excluded.project,
       updated_at = clock_timestamp()`,
    [id, project.name, project.sourceKind, payload],
  );
}

export async function getSavedPiece(
  sql: QuerySql,
  id: string,
): Promise<SavedPiece | null> {
  const rows = await sql.query<PieceRow>(
    `select id, name, source_kind, project, updated_at
     from pieces
     where id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const project = parseStoredProject(row.project);
  return {
    id: row.id,
    name: row.name,
    sourceKind: asSourceKind(row.source_kind),
    thumbnail: thumbnailFromProject(project),
    updatedAt: asIso(row.updated_at),
    project,
  };
}

export async function listRecentPieces(
  sql: QuerySql,
  limit = 12,
): Promise<PieceSummary[]> {
  const rows = await sql.query<PieceRow>(
    `select
       id,
       name,
       source_kind,
       coalesce(
         nullif(project->>'photoDataUrl', ''),
         project->'photos'->>0,
         project->>'image'
       ) as thumbnail,
       updated_at
     from pieces
     order by updated_at desc, id desc
     limit $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sourceKind: asSourceKind(row.source_kind),
    thumbnail: row.thumbnail ?? null,
    updatedAt: asIso(row.updated_at),
  }));
}
