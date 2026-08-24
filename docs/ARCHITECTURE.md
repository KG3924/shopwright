# Architecture

## Pipeline

```
photo | URL | catalog
        ↓
   extractor (vision / scrape / template)
        ↓
   canonical project graph
   (parts with parametric dims, routes, hardware, steps)
        ↓
   skill compiler + species + ZIP
        ↓
   shop packet
```

## Project graph

A part is not a static 48×14×¾. It is:

```
length: { from: "w", offset: 0 }      // tracks overall width
width:  { from: "d", offset: 0 }
thickness: { from: "fixed", offset: 0.75 }
```

A long apron is `{ from: "w", offset: -3 }` because two 1½" legs eat three inches. Drag the width slider; the apron follows. Type 52" on the top panel and that length locks (`partOverrides`) so overall W can keep moving without dragging that board.

Routes (`pocket`, `dado`, `mortise`, …) filter hardware, steps, and sometimes parts (a slab door vs. frame-and-panel).

Shop drawings (elevations, exploded assembly, part tickets) are SVG compiled from the resolved cut list placed in space, so a locked part shows up on the drawing the same turn. They are not picked from a pool of furniture silhouettes. Elevations are one story: a photo-traced outline (seat dish, splay, plan shape) or the lettered blanks, never both fighting. The exploded isometric is the cut-list blanks pulled apart — one lettered board per ticket — not a second tracing of the photo. Curves stay on the elevations.

## Hydration from a photo

The vision model returns JSON: name, overall, confidence, uncertainties, a **complete parts list with inches and 3D instances**, optional `templateId`. You can send up to six photos of the same piece; the first three go at high detail.

If `templateId` matches a studio piece it is **ignored on photo / URL / blueprint hydrate**. Joinery, hardware, steps, finish, and technique plates compile from this interpret only (parts, `drawing.backStyle` or an explicit lattice tag, finish/species, uncertainties). Lattice hardware/steps/figures attach only when interpret tagged the back as lattice — splat, solid, crest, and none do not.

For `photo` / `url` / `blueprint`, the **cut list always comes from vision**. Fewer than two boards with sourced axes, invalid JSON, or a missing overall is a typed error — we never silently emit template stock parts. After that gate, a pure infer-fill pass may label SAFE unknown axes as `inferred` (symmetric twins, overall→box, seat-height bands, stretcher clear span) — never `measured`, never typical stock thickness. Compile holds Don't-cut on weak/conflict scale, `?` tickets, or an unlocked inferred axis; a builder lock (`locked — your tape`) clears that axis. Infer-fill does not bake a sticky `project.doNotCut`. Unknown stock thickness stays `?` until the builder picks ½″ / ¾″ / 1″ (or types inches) on the cut-list InchField — that lock is the same override path, never `measured`. Catalog pieces are unchanged.

Each part can carry `instances` (front-left-floor origin, x right, y back, z up) and per-axis `measured` truth. The layout compiler places every copy, then projects front / side / plan and an exploded assembly. Part tickets are face, edge, and end of that board — printing `?` when an axis was not sourced.

Chair classification is still explicit for drawings: a lattice-back kitchen chair is not an Adirondack. That does not load catalog joinery onto a photo packet.

## AI

Server functions only. `XAI_API_KEY` never leaves the server.

- `interpretPiece` — grok-4.5 vision, user-initiated, image capped ~1280px JPEG
- `askMaster` — grok-4.5 chat, packet stuffed into the system prompt, last 8 turns, 700 token cap

No calls on page load. No loops. One retry at most is the caller’s job; we surface errors.

## Persistence

Zustand + localStorage for rank, ZIP, tools, and the active piece id. Uploaded
photos are too large for localStorage, so interpret results (photos + project
graph / packet) are stored in **local PGLite only** while auth is deferred.
If `DATABASE_URL` is set (shared Neon/Postgres), save / list / get refuse and
do not read or write that store. Rows are keyed by piece id, not a user —
there is no login. Home and Studio list recent pieces on the local path;
opening one restores photos, locks, tools, and the compiled packet.

Catalog thumbnails live in `/public/catalog`. Saving a catalog run stores a
copy of that packet; catalog fixtures themselves are unchanged.
