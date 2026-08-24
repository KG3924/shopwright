import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { CATALOG } from "./catalog";
import { compilePacket, instantiate } from "./compile";
import {
  formatCutTriplet,
  ticketUnknownAxes,
} from "./measure";
import {
  getSavedPieceRpc,
  listRecentPiecesRpc,
  pieceStoreSourceFromEnv,
  savePieceRpc,
} from "./piece-rpc";
import {
  getSavedPiece,
  listRecentPieces,
  upsertSavedPiece,
  type QuerySql,
} from "./piece-store";
import {
  newPieceId,
  parseStoredProject,
  safeThumbnailSrc,
  shouldWritePiece,
  thumbnailFromProject,
} from "./saved-pieces";
import { hydrateVision, parseVisionJson, type InterpretInput } from "./ai/hydrate";
import type { Project } from "./types";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "../..");
const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const PIXEL_B =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const input: InterpretInput = {
  kind: "photo",
  rank: "beginner",
  toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
};

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function photoProject(): Project {
  const fixture = JSON.parse(
    readFileSync(join(dir, "ai/fixtures/tape-stool-pass.json"), "utf8"),
  ) as { ai: unknown };
  const project = hydrateVision(
    parseVisionJson(JSON.stringify(fixture.ai)),
    input,
    [PIXEL, PIXEL_B],
  );
  const seatId = project.parts.find((p) => /seat/i.test(p.name))!.id;
  return {
    ...project,
    photos: [PIXEL, PIXEL_B],
    photoDataUrl: PIXEL,
    partOverrides: { [seatId]: { length: 15 } },
    toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
  };
}

function catalogProject(): Project {
  const bench = CATALOG.find((p) => p.id === "bench")!;
  return instantiate(bench, {
    rank: "beginner",
    toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
  });
}

async function testSql(): Promise<{ sql: QuerySql; close: () => Promise<void> }> {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(read("migrations/0001_pieces.sql"));
  const sql: QuerySql = {
    query: async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
      const result = await pg.query(text, params);
      return result.rows as T[];
    },
  };
  return { sql, close: () => pg.close() };
}

describe("saved piece helpers", () => {
  it("mints a unique piece id distinct from the template id", () => {
    const a = newPieceId();
    const b = newPieceId();
    assert.match(a, /^[0-9a-f-]{36}$/i);
    assert.notEqual(a, b);
    assert.notEqual(a, photoProject().id);
  });

  it("writes photo pieces that still have uploads, not stripped localStorage shells", () => {
    const project = photoProject();
    assert.equal(shouldWritePiece(project), true);
    const stripped: Project = {
      ...project,
      photoDataUrl: undefined,
      photos: [],
    };
    assert.equal(shouldWritePiece(stripped), false);
  });

  it("always writes a catalog run (fixture image is not a user upload)", () => {
    const project = catalogProject();
    assert.equal(project.sourceKind, "catalog");
    assert.equal(shouldWritePiece(project), true);
    assert.equal(project.photos[0]?.startsWith("data:"), false);
    assert.match(project.photos[0] ?? "", /\/catalog\//);
  });

  it("JSON round-trip restores photos, locks, tools, and drawing", () => {
    const project = photoProject();
    const restored = parseStoredProject(JSON.parse(JSON.stringify(project)));
    assert.deepEqual(restored.photos, [PIXEL, PIXEL_B]);
    assert.equal(restored.photoDataUrl, PIXEL);
    assert.equal(restored.toolsAvailable.includes("kreg-jig"), true);
    const seatId = project.parts.find((p) => /seat/i.test(p.name))!.id;
    assert.equal(restored.partOverrides[seatId]?.length, 15);
    assert.equal(restored.drawing?.family, project.drawing?.family);
  });

  it("thumbnail prefers the first photo", () => {
    assert.equal(thumbnailFromProject(photoProject()), PIXEL);
    assert.equal(thumbnailFromProject(catalogProject()), catalogProject().photos[0]);
  });

  it("does not persist blob: photos that die on reopen", () => {
    const project = photoProject();
    const blobOnly: Project = {
      ...project,
      photos: ["blob:http://localhost/dead-photo"],
      photoDataUrl: "blob:http://localhost/dead-photo",
    };
    assert.equal(shouldWritePiece(blobOnly), false);
  });

  it("thumbnail src is allowlisted — no javascript, blob, or html data", () => {
    assert.equal(safeThumbnailSrc(PIXEL), PIXEL);
    assert.equal(safeThumbnailSrc("/catalog/bench.jpg"), "/catalog/bench.jpg");
    assert.equal(safeThumbnailSrc("https://cdn.example/photo.jpg"), "https://cdn.example/photo.jpg");
    assert.equal(safeThumbnailSrc("javascript:alert(1)"), null);
    assert.equal(safeThumbnailSrc("blob:http://localhost/x"), null);
    assert.equal(safeThumbnailSrc("data:text/html,<img>"), null);
    assert.equal(safeThumbnailSrc("data:image/svg+xml,<svg>"), null);
  });
});

describe("save then reopen against the local db", () => {
  it("stores a photo interpret and restores photos + packet (cuts, tools, locks)", async () => {
    const { sql, close } = await testSql();
    try {
      const project = photoProject();
      const before = compilePacket(project, "75013");
      const id = newPieceId();

      await upsertSavedPiece(sql, id, project);
      const listed = await listRecentPieces(sql);
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.id, id);
      assert.equal(listed[0]?.name, project.name);
      assert.equal(listed[0]?.sourceKind, "photo");
      assert.equal(listed[0]?.thumbnail, PIXEL);

      const opened = await getSavedPiece(sql, id);
      assert.ok(opened);
      assert.deepEqual(opened.project.photos, [PIXEL, PIXEL_B]);
      assert.equal(opened.project.toolsAvailable.includes("kreg-jig"), true);
      const seatId = project.parts.find((p) => /seat/i.test(p.name))!.id;
      assert.equal(opened.project.partOverrides[seatId]?.length, 15);

      const after = compilePacket(opened.project, "75013");
      const seat = after.cuts.find((c) => /seat/i.test(c.name));
      assert.ok(seat);
      assert.equal(seat.locked.length, true);
      assert.equal(seat.length, 15);
      assert.equal(formatCutTriplet(seat), formatCutTriplet(before.cuts.find((c) => c.id === seat.id)!));
      assert.equal(ticketUnknownAxes(after.cuts), ticketUnknownAxes(before.cuts));
      assert.equal(after.project.toolsAvailable.includes("kreg-jig"), true);
      assert.equal(after.doNotCut, before.doNotCut);
    } finally {
      await close();
    }
  });

  it("lists recent pieces newest first and keeps catalog sourceKind", async () => {
    const { sql, close } = await testSql();
    try {
      const photo = photoProject();
      const catalog = catalogProject();
      const photoId = newPieceId();
      const catalogId = newPieceId();
      await upsertSavedPiece(sql, photoId, photo);
      await new Promise((r) => setTimeout(r, 25));
      await upsertSavedPiece(sql, catalogId, catalog);

      const listed = await listRecentPieces(sql);
      assert.equal(listed.length, 2);
      assert.equal(listed[0]?.id, catalogId);
      assert.equal(listed[0]?.sourceKind, "catalog");
      assert.equal(listed[1]?.id, photoId);
      assert.match(listed[0]?.thumbnail ?? "", /\/catalog\//);

      const opened = await getSavedPiece(sql, catalogId);
      assert.equal(opened?.project.sourceKind, "catalog");
      assert.equal(opened?.project.photos[0]?.startsWith("data:"), false);
      const packet = compilePacket(opened!.project, "75013");
      assert.ok(packet.cuts.length > 0);
    } finally {
      await close();
    }
  });

  it("upserts locks on the same piece id without duplicating the row", async () => {
    const { sql, close } = await testSql();
    try {
      const project = photoProject();
      const id = newPieceId();
      await upsertSavedPiece(sql, id, project);
      const seatId = project.parts.find((p) => /seat/i.test(p.name))!.id;
      const next: Project = {
        ...project,
        partOverrides: { [seatId]: { length: 16, thickness: 0.75 } },
      };
      await upsertSavedPiece(sql, id, next);
      const listed = await listRecentPieces(sql);
      assert.equal(listed.length, 1);
      const opened = await getSavedPiece(sql, id);
      assert.equal(opened?.project.partOverrides[seatId]?.length, 16);
      assert.equal(opened?.project.partOverrides[seatId]?.thickness, 0.75);
      assert.deepEqual(opened?.project.photos, [PIXEL, PIXEL_B]);
    } finally {
      await close();
    }
  });

  it("does not persist a stripped photo shell over a saved piece", async () => {
    const { sql, close } = await testSql();
    try {
      const project = photoProject();
      const id = newPieceId();
      await upsertSavedPiece(sql, id, project);
      const stripped: Project = {
        ...project,
        photos: [],
        photoDataUrl: undefined,
      };
      assert.equal(shouldWritePiece(stripped), false);
      if (shouldWritePiece(stripped)) {
        await upsertSavedPiece(sql, id, stripped);
      }
      const opened = await getSavedPiece(sql, id);
      assert.deepEqual(opened?.project.photos, [PIXEL, PIXEL_B]);
    } finally {
      await close();
    }
  });
});

describe("save-packet wiring and copy", () => {
  it("home and studio list recent pieces and reopen a saved packet", () => {
    const home = read("src/components/home-view.tsx");
    const studio = read("src/components/studio-view.tsx");
    const store = read("src/lib/store.ts");
    const api = read("src/lib/piece-api.ts");
    const persist = read("src/lib/use-persist-piece.ts");

    assert.match(home, /useRecentPieces/);
    assert.match(home, /savePiece/);
    assert.match(home, /data-recent-pieces/);
    assert.match(home, /getSavedPiece/);
    assert.match(studio, /getSavedPiece/);
    assert.match(studio, /savePiece/);
    assert.match(studio, /data-recent-pieces/);
    assert.match(persist, /listRecentPieces/);
    assert.match(store, /activePieceId/);
    assert.doesNotMatch(api, /authMiddleware|requireUserId/);
    assert.doesNotMatch(api, /user_id/);
  });

  it("pieces table is unowned — keyed by piece id, not a user", () => {
    const sql = read("migrations/0001_pieces.sql");
    assert.match(sql, /create table if not exists pieces/i);
    assert.doesNotMatch(sql, /user_id/);
    assert.match(sql, /project jsonb not null/i);
  });

  it("auth stays off this path", () => {
    const api = read("src/lib/piece-api.ts");
    const store = read("src/lib/piece-store.ts");
    const rpc = read("src/lib/piece-rpc.ts");
    assert.doesNotMatch(api, /from ["']@\/lib\/auth/);
    assert.doesNotMatch(store, /from ["']@\/lib\/auth/);
    assert.doesNotMatch(rpc, /authMiddleware|requireUserId|user_id/);
    assert.doesNotMatch(api, /VITE_AUTH_ENABLED/);
    assert.match(api, /dbSource/);
    assert.match(api, /listRecentPiecesRpc|savePieceRpc|getSavedPieceRpc/);
  });
});

describe("piece store is local PGLite only while auth is deferred", () => {
  it("DATABASE_URL / nonempty postgres URL is the shared Neon path", () => {
    assert.equal(pieceStoreSourceFromEnv(undefined), "pglite");
    assert.equal(pieceStoreSourceFromEnv(""), "pglite");
    assert.equal(pieceStoreSourceFromEnv("  "), "pglite");
    assert.equal(
      pieceStoreSourceFromEnv("postgresql://user:pass@ep-x.neon.tech/neondb"),
      "neon",
    );
  });

  it("shared Neon path refuses list, get, and save without opening sql", async () => {
    let opened = 0;
    const openSql = async (): Promise<QuerySql> => {
      opened += 1;
      throw new Error("shared store must not be opened");
    };
    const listed = await listRecentPiecesRpc("neon", openSql);
    const got = await getSavedPieceRpc("neon", openSql, "any-id");
    const saved = await savePieceRpc("neon", openSql, "any-id", photoProject());
    assert.equal(opened, 0);
    assert.deepEqual(listed, { ok: false, reason: "shared-store" });
    assert.deepEqual(got, { ok: false, reason: "shared-store" });
    assert.deepEqual(saved, { ok: false, reason: "shared-store" });
  });

  it("PGLite path still saves and reopens through the guarded RPCs", async () => {
    const { sql, close } = await testSql();
    try {
      const openSql = async () => sql;
      const project = photoProject();
      const id = newPieceId();
      const saved = await savePieceRpc("pglite", openSql, id, project);
      assert.deepEqual(saved, { ok: true });
      const listed = await listRecentPiecesRpc("pglite", openSql);
      assert.equal(listed.ok, true);
      if (!listed.ok) throw new Error("expected pglite list to succeed");
      assert.equal(listed.pieces[0]?.id, id);
      const got = await getSavedPieceRpc("pglite", openSql, id);
      assert.equal(got.ok, true);
      if (!got.ok) throw new Error("expected pglite get to succeed");
      assert.deepEqual(got.piece?.project.photos, [PIXEL, PIXEL_B]);
    } finally {
      await close();
    }
  });
});
