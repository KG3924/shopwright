import { createServerFn } from "@tanstack/react-start";
import { dbSource, getSql } from "./db";
import {
  getSavedPieceRpc,
  listRecentPiecesRpc,
  savePieceRpc,
} from "./piece-rpc";
import type { Project } from "./types";

export const listRecentPieces = createServerFn({ method: "POST" }).handler(
  async () => {
    const result = await listRecentPiecesRpc(dbSource, getSql);
    if (!result.ok) return [];
    return result.pieces;
  },
);

export const getSavedPiece = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const result = await getSavedPieceRpc(dbSource, getSql, data.id);
    if (!result.ok) return null;
    return result.piece;
  });

export const savePiece = createServerFn({ method: "POST" })
  .validator((input: { id: string; project: Project }) => input)
  .handler(async ({ data }) => {
    return savePieceRpc(dbSource, getSql, data.id, data.project);
  });
