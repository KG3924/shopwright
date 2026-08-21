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

A long apron is `{ from: "w", offset: -3 }` because two 1½" legs eat three inches. Drag the width slider; the apron follows.

Routes (`pocket`, `dado`, `mortise`, …) filter hardware, steps, and sometimes parts (a slab door vs. frame-and-panel).

## Hydration from a photo

The vision model returns JSON: name, overall, confidence, uncertainties, optional `templateId`. If `templateId` matches a studio piece, we **scale that template** to the inferred overall size. That is what makes a photo of a bench produce a real cut list instead of hallucinated joinery.

If it matches nothing, parts come back as raw inches and we infer which axis they track from the part name and proximity to overall W/D/H.

## AI

Server functions only. `XAI_API_KEY` never leaves the server.

- `interpretPiece` — grok-4.5 vision, user-initiated, image capped ~1280px JPEG
- `askMaster` — grok-4.5 chat, packet stuffed into the system prompt, last 8 turns, 700 token cap

No calls on page load. No loops. One retry at most is the caller’s job; we surface errors.

## Persistence

Zustand + localStorage for rank, ZIP, and the current project. Uploaded photos are not persisted (quota). Catalog thumbnails live in `/public/catalog`.

Auth is off. Database is off. Nothing personal is stored server-side.
