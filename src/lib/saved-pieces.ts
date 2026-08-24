import { projectPhotos } from "./types";
import type { Project } from "./types";

export type PieceSummary = {
  id: string;
  name: string;
  sourceKind: Project["sourceKind"];
  thumbnail: string | null;
  updatedAt: string;
};

export type SavedPiece = PieceSummary & {
  project: Project;
};

export function newPieceId(): string {
  return crypto.randomUUID();
}

/**
 * Catalog runs are always writable (fixture thumbnails, not uploads).
 * Photo / URL / blueprint runs must still have a real image — never overwrite
 * a saved piece with the stripped localStorage shell (data URLs are quota-dropped).
 */
export function shouldWritePiece(project: Project): boolean {
  if (project.sourceKind === "catalog") return true;
  return projectPhotos(project).some(
    (p) =>
      p.startsWith("data:") ||
      p.startsWith("blob:") ||
      p.startsWith("http://") ||
      p.startsWith("https://"),
  );
}

export function thumbnailFromProject(project: Project): string | null {
  return projectPhotos(project)[0] ?? project.image ?? null;
}

export function parseStoredProject(raw: unknown): Project {
  const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!value || typeof value !== "object") {
    throw new Error("Saved piece is missing its packet.");
  }
  const project = value as Project;
  const photos = projectPhotos(project);
  return {
    ...project,
    photos,
    photoDataUrl: project.photoDataUrl ?? photos[0],
    partOverrides: project.partOverrides ?? {},
    toolsAvailable: project.toolsAvailable ?? [],
  };
}

export function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}
