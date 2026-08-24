# Vision brief (for Shopwright Grok bots)

The live API uses [`src/lib/ai/interpret-system.ts`](../src/lib/ai/interpret-system.ts). Paste that system prompt into any Grok vision bot that reads furniture photos.

## Why readings were coming back boxy and low-confidence

1. The old brief said `confidence < 0.7 if the underside is hidden`. That punished a clear saddle seat because you could not see pocket holes.
2. The brief never asked for **seat profile, plan shape, or an outline polyline**, so the model named a “chair” and the compiler drew rectangles.

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
```

## Photo set that actually works

1. Side elevation, whole chair, level to the seat (authority for saddle and back rake)
2. Front elevation (splay, crest)
3. Three-quarter or plan of the seat (horseshoe vs square)
4. Detail of the seat front / dish
5. Underside if you can (joinery — does not affect form confidence)
6. Tape in frame against a known edge
