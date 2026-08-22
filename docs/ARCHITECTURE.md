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

Shop drawings (elevations, exploded assembly, part tickets) are SVG compiled from the resolved cut list, so a locked part shows up on the drawing the same turn.

## Hydration from a photo

The vision model returns JSON: name, overall, confidence, uncertainties, optional `templateId`, and a `drawing` spec (family, backStyle, seatShape, arms, footring, recline). You can send up to six photos of the same piece; the first three go at high detail. If `templateId` matches a studio piece, we **scale that template** to the inferred overall size.

Chair classification is explicit: a lattice-back kitchen chair is `side-chair` (upright, diamond lattice, square seat). Adirondack is only for reclined outdoor fan-slat chairs. Shop drawings compile from the drawing spec and the cut list, not from a single "chair = Adirondack" silhouette.

If it matches nothing, parts come back as raw inches and we infer which axis they track from the part name and proximity to overall W/D/H.

## AI

Server functions only. `XAI_API_KEY` never leaves the server.

- `interpretPiece` — grok-4.5 vision, user-initiated, image capped ~1280px JPEG
- `askMaster` — grok-4.5 chat, packet stuffed into the system prompt, last 8 turns, 700 token cap

No calls on page load. No loops. One retry at most is the caller’s job; we surface errors.

## Persistence

Zustand + localStorage for rank, ZIP, and the current project. Uploaded photos are not persisted (quota). Catalog thumbnails live in `/public/catalog`.

Auth is off. Database is off. Nothing personal is stored server-side.
