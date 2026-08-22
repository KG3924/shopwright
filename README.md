# Shopwright

**v0.1 — from a photo to a shop packet.**

Shopwright is a woodworking studio that treats a photograph as a *reading*, not a clone. You drop pictures of a bench, a console, a bookcase, a product-page screenshot, or a scanned plan. The app infers the structure you cannot see, then compiles a shop packet: cut list, shop drawings, fasteners, lumber stops, species consequences, and a tutorial that changes with your rank.

This is an interpretation a competent shop would build. Factory cam-locks and hidden construction stay labeled as inference.

## Run it

You need **Node 22** and npm.

```bash
git clone https://github.com/KG3924/shopwright.git
cd shopwright
npm install
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080). Always start with `npm run dev` — not `vite` directly. The npm script loads app env the rest of the toolchain expects.

The eight **studio pieces** (lattice-back chair, bench, console, bookcase, coffee table, wall cabinet, Adirondack, cedar hopper feeder) work with no extra setup. Click one, change size / rank / species, and read the packet. Shop drawings follow the piece — a lattice-back chair is not drawn as an Adirondack.

### Photo, links, and the Master Woodworker

Those paths call the xAI API. Export a key in the same shell before `npm run dev`:

```bash
export XAI_API_KEY="xai-..."
npm run dev
```

Without the key, the catalog still runs. Upload / paste-a-link / Ask the Master will say AI is unavailable instead of crashing.

Do not commit the key. Do not put it in a tracked `.env`.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at `0.0.0.0:8080` |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build at `127.0.0.1:8081` (run `build` first) |
| `npm run typecheck` | TypeScript, no emit |

`src/routeTree.gen.ts` is generated on first `npm run dev` / `npm run build`. It is not in git.

## What v0.1 does

- **Several photos** — up to six angles of the same piece (front, side, underside, a tape in frame). One interpret pass uses all of them.
- **Product URL** — fetches the page, reads dimensions and images when it can
- **Studio catalog** — seven pieces you can open without a photo, including a full hip-roof hopper feeder
- **Shop packet** — lettered cut list, board-by-board lumber, fasteners with where they go, printable elevations
- **Shop drawings** — compiled from the boards we read in the photos: front / side / plan, exploded assembly, and a face-edge-end ticket for every part at those inches. Not a stock silhouette. Print them. They follow sizes you lock.
- **Per-part size** — overall W / D / H still drive the piece. Type a length on one board to lock it so it no longer follows.
- **Construction routes** — when the underside is unclear, you pick pocket holes vs. dados vs. dovetails
- **Rank** — Beginner → Master. Technique modules appear only when they still teach you something
- **Species** — weight, stain, weather, movement, cost
- **Location** — lumber and hardware stops, with Allen / North Dallas mapped in detail
- **Master Woodworker** — a bench-side agent that answers against the current packet

## What it is not

It will not reverse-engineer a factory SKU into CNC-ready clones. Scale without a labeled dimension is estimated. Joinery you cannot see is a *route*, not a fact. Confirm the four overall numbers — and any locked part — before you cut.

## Docs

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product intent
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the project graph and compiler
- [`docs/V01_SCOPE.md`](docs/V01_SCOPE.md) — what shipped in 0.1 and what’s next
