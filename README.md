# Shopwright

**v0.1 — from a photo to a shop packet.**

Shopwright is a woodworking studio that treats a photograph as a *reading*, not a clone. You drop a picture of a bench, a console, a bookcase, a product-page screenshot, or a scanned plan. The app infers the structure you cannot see, then compiles a shop packet: cut list, fasteners, lumber stops, species consequences, and a tutorial that changes with your rank.

This is an interpretation a competent shop would build. Factory cam-locks and hidden construction stay labeled as inference.

## What v0.1 does

- **Photo / plan upload** — vision model reads the piece, returns a structured project graph
- **Product URL** — fetches the page, reads dimensions and images when it can
- **Studio catalog** — six pieces you can open without a photo (bench, console, bookcase, coffee table, wall cabinet, Adirondack)
- **Construction routes** — when the underside is unclear, you pick pocket holes vs. dados vs. dovetails
- **Parametric fit** — change overall W / D / H; dependent parts move
- **Rank** — Beginner → Master. Technique modules appear only when they still teach you something
- **Species** — weight, stain, weather, movement, cost
- **Location** — lumber and hardware stops, with Allen / North Dallas mapped in detail
- **Master Woodworker** — a bench-side agent that answers against the current packet

## What it is not

It will not reverse-engineer a factory SKU into CNC-ready clones. Scale without a labeled dimension is estimated. Joinery you cannot see is a *route*, not a fact. Confirm the four overall numbers before you cut.

## Repo

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product intent
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the project graph and compiler
- [`docs/V01_SCOPE.md`](docs/V01_SCOPE.md) — what shipped in 0.1 and what’s next

Built as a TanStack Start app. Local preview is handled by the host environment.
