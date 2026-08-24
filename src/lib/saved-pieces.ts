import { randomUuid } from "./random-uuid";
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
  return randomUuid();
}

/**
 * Catalog runs are always writable (fixture thumbnails, not uploads).
 * Photo / URL / blueprint runs must still have a real image — never overwrite
 * a saved piece with the stripped localStorage shell (data URLs are quota-dropped).
 * `blob:` URLs die on reopen, so they are not persistable.
 */
const DATA_IMAGE_RE = /^data:image\/(?:jpeg|jpg|png|gif|webp)[;,]/i;

export function shouldWritePiece(project: Project): boolean {
  if (project.sourceKind === "catalog") return true;
  return projectPhotos(project).some(
    (p) =>
      DATA_IMAGE_RE.test(p) ||
      p.startsWith("https://") ||
      p.startsWith("http://"),
  );
}

/** Display allowlist for list thumbnails. Rejects javascript:, blob:, html/svg data. */
export function safeThumbnailSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  if (DATA_IMAGE_RE.test(src)) return src;
  if (src.startsWith("/catalog/") && !src.includes("..") && !src.includes("\\")) {
    return src;
  }
  try {
    const url = new URL(src);
    if (url.protocol === "https:") return src;
  } catch {
    return null;
  }
  return null;
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
