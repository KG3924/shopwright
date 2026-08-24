# Vision brief (for Shopwright Grok bots)

The live API uses [`src/lib/ai/interpret-system.ts`](../src/lib/ai/interpret-system.ts). Paste that system prompt into any Grok vision bot that reads furniture photos.

## Why readings were coming back boxy

1. The old brief said `confidence < 0.7 if the underside is hidden`. That punished a clear saddle seat because you could not see pocket holes.
2. The brief never asked for **seat profile, plan shape, or an outline polyline**, so the model named a “chair” and the compiler drew rectangles.
3. Even after outlines landed, a reading could still hydrate as a **flat square slab** when:
   - the model returned `seatProfile: "flat"` / a 4-corner `sideOutline` despite naming a saddle in prose, or
   - Zod dropped a close-but-wrong enum (`"saddle"` vs `"saddled"`) and the compiler fell back to a box, or
   - a product URL only yielded a tiny `og:image` crop (or a captcha page) so vision never saw the dish.

The compiler now lifts named curves out of interpretation / notes, rejects rectilinear side outlines when the seat is shaped, and refuses a URL with no usable photo.

## Split confidence

| Field | Means | Typical when the photos are good |
| --- | --- | --- |
| `confidence` | Visible **form** — outline, seat curve, legs, part count | 0.8–0.95 |
| `constructionConfidence` | Joinery / underside / fasteners | 0.35–0.7 |
| `uncertainties` | What you still cannot see | Joinery, exact dish, species |

Do not drop form confidence because joinery is hidden.

## Builder note (paste next to the photos)

Use this as the user/builder note. Name the curves you care about:

```
Look at the OUTLINE first, not the furniture category.

Seat: say whether it is flat, saddled, tractor, dished, waterfall, or sculpted. Estimate dish in inches. Name the plan (square, rounded-rect, round, horseshoe, D, shield). Name the front edge (square, rounded, waterfall, rolled, bullnose).

Legs: straight, tapered, splayed, cabriole, saber, turned. Taper-to size and splay in degrees if you can see them.

Back: upright, reclined, curved, hoop, Windsor, ladder. Lattice vs splat vs slats.

Return drawing.sideOutline / frontOutline / planOutline as 0–1 polylines traced from the photos. A rectangle is wrong if the piece is not rectilinear.

Blanks on the cut list are rectangles you cut BEFORE shaping. Put the shaping in part notes.

Do not replace this piece with a stock Shaker, box stool, or Adirondack.

If the photo is metal or plastic, still build it in wood. Say so. Do not emit steel blanks.
```

## Photo set that actually works

1. Side elevation, whole chair, level to the seat (authority for saddle and back rake)
2. Front elevation (splay, crest)
3. Three-quarter or plan of the seat (horseshoe vs square)
4. Detail of the seat front / dish
5. Underside if you can (joinery — does not affect form confidence)
6. Tape in frame against a known edge

A single three-quarter product shot can still work if the seat dish is visible as a highlight. A share-card crop often cannot.

## Manual verify — AllModern Leola (curved / saddle-ish seat)

Repro URL:

https://www.wayfair.com/furniture/pdp/allmodern-leola-solid-wood-low-back-side-chair-in-brown-w110057005.html

Wayfair often serves a PerimeterX wall or a tiny `og:image`. If paste-a-link comes back “no product photo” or “page blocked”, that is honesty — **upload a photo of the chair** (or a screenshot of the product hero, not the 200px share card).

On a good reading, Sheet 1 should show:

- Caption names a **saddled / sculpted / dished** seat — not “square seat” alone
- Side elevation heavy line **dips** at the seat (not a flat slab on four posts)
- Seat ticket notes say the blank is rectangular and you shape the saddle after
- Exploded assembly stays boxes (letters + blanks). Photo outlines are elevations only
- Don’t-cut / `?` thickness / Infer-Fill behavior unchanged if there is no tape

If the model returns “wood dining chair, square seat, four legs” for a clearly dished Leola, that is a failed vision reading — the pipeline will still lift a named saddle out of the interpretation, but it cannot invent a dish from generic box language.

## Material translation (metal / plastic → wood)

Photos may show furniture that is **not wood** — a tubular folding stool, a plastic patio chair, chrome legs. Shopwright still reads the form and compiles a **wooden shop packet**.

| Keep | Translate | Do not |
| --- | --- | --- |
| Outline, fold geometry, seat size, height, brace layout | Cut list in solid / ply; wood species; wood joinery routes | Refuse (“it’s metal”) |
| Hinges, pins, folding stays as **buy hardware** | `stock: solid` (or plywood) on every blank | Steel / aluminum / plastic blanks |
| Honesty line in interpretation + uncertainties | `templateId` / category from the **form** (folding stool → chair / side-chair) | Copy sheet-metal gauge as a measured wood thickness |

Required honesty copy:

```
Source piece appears metal/plastic; translated to wood build.
```

Hydrate enforces this even if the model emits `stock: "steel"` or a 1/16" “measured” tube wall: stock becomes solid/ply, that thickness becomes `?`, species stays a wood.

