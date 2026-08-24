import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import {
  getSavedPiece as loadSavedPiece,
  listRecentPieces as loadRecentPieces,
  upsertSavedPiece,
} from "./piece-store";
import { shouldWritePiece } from "./saved-pieces";
import type { Project } from "./types";

export const listRecentPieces = createServerFn({ method: "POST" }).handler(
  async () => {
    const sql = await getSql();
    return loadRecentPieces(sql, 12);
  },
);

export const getSavedPiece = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    return loadSavedPiece(sql, data.id);
  });

export const savePiece = createServerFn({ method: "POST" })
  .validator((input: { id: string; project: Project }) => input)
  .handler(async ({ data }) => {
    if (!shouldWritePiece(data.project)) {
      return { ok: false as const, skipped: true };
    }
    const sql = await getSql();
    await upsertSavedPiece(sql, data.id, data.project);
    return { ok: true as const };
  });
