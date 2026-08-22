import { useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { LatticeJoinery } from "@/components/chair-drawings";
import { inferDrawing } from "@/lib/drawing";
import { layoutBoxes, type WorldBox } from "@/lib/layout";
import {
  formatCutAxis,
  formatCutAxisSource,
  formatCutSources,
  formatCutTriplet,
  formatDoNotCut,
  ticketIdentity,
  ticketViewLabels,
  type CutAxis,
  type CutHold,
} from "@/lib/measure";
import { RANK_META } from "@/lib/ranks";
import {
  assemblyStepsOpen,
  elevationCallout,
  elevationViewAxes,
  explodeOffset,
  formatElevationCallout,
  isoShowsBadge,
  isMajorShopPart,
  isQuietRank,
  labelElevationParts,
  separateBadges,
} from "@/lib/shop-views";
import type { CutRow, HardwareItem, Overall, Rank, ShopPacket } from "@/lib/types";
import { projectPhotos } from "@/lib/types";
import { Button } from "./ui/button";

const INK = "var(--color-ink)";
const PAPER = "var(--color-paper)";
const WOOD = "var(--color-paper-2)";
const WOOD_DK = "#cfc3ab";

export function DoNotCutCallout({ hold }: { hold: CutHold }) {
  return (
    <aside className="rounded-sm border border-ink/40 bg-paper px-3 py-3">
      <p className="font-display text-lg text-ink">{hold.headline}</p>
      <ul className="mt-2 space-y-1 text-sm text-ink-soft">
        {hold.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </aside>
  );
}

export function ShopDrawings({ packet }: { packet: ShopPacket }) {
  const { project, cuts, route, species } = packet;
  const overall = project.overall;
  const spec = inferDrawing(project);
  const photos = projectPhotos(project);
  const fromPhotos =
    project.sourceKind === "photo" ||
    project.sourceKind === "url" ||
    project.sourceKind === "blueprint" ||
    project.partsFromPhotos;
  const cutHold = formatDoNotCut({
    doNotCut: packet.doNotCut,
    routeRunnable: packet.routeRunnable,
    scaleConfidence: project.scaleConfidence,
    scaleNotes: project.scaleNotes,
  });
  const boxes = layoutBoxes(overall, cuts, {
    seatHeightRatio: spec.seatHeightRatio,
  });
  const exploded = layoutBoxes(overall, cuts, {
    explode: explodeOffset(overall, project.rank),
    seatHeightRatio: spec.seatHeightRatio,
  });
  const lattice = cuts.some((c) => /lattice|half-?lap|diamond/i.test(`${c.id} ${c.name}`));
  const feeder = cuts.some((c) => /petg|hopper|hip|roof|tray/i.test(`${c.id} ${c.name}`));

  return (
    <div className="shop-drawings space-y-8">
      {cutHold ? (
        <div className="shop-print-hold mb-4">
          <DoNotCutCallout hold={cutHold} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="max-w-xl text-sm text-ink-soft">
          {fromPhotos
            ? "Compiled from the boards we read in the photos — the same inches as the cut list. Not a stock silhouette. Do not scale the pictures; cut to the tickets."
            : "Compiled from this piece’s parts. Do not scale the pictures — cut to the numbers. Unlocked parts follow overall W / D / H."}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="border-ink/20 text-ink hover:bg-ink/5"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          Print shop packet
        </Button>
      </div>

      <Sheet
        title={project.name}
        sheet="1"
        meta={`${formatElevationCallout("W", overall.w)} × ${formatElevationCallout("D", overall.d)} × ${formatElevationCallout("H", overall.h)}  ·  ${species.name}  ·  ${route.name}  ·  ${RANK_META[project.rank].label}`}
      >
        <PhotoStrip photos={photos} fromPhotos={!!fromPhotos} />
        <p className="mb-4 max-w-2xl text-sm text-ink-soft">
          {project.interpretation}
        </p>
        <StackList stack={packet.stack} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <ProjectedView label="Front" mode="front" boxes={boxes} overall={overall} />
          <ProjectedView label="Side" mode="side" boxes={boxes} overall={overall} />
          <ProjectedView label="Plan (top)" mode="plan" boxes={boxes} overall={overall} />
        </div>
        {project.uncertainties.length ? (
          <div className="mt-5 rounded-sm border border-ink/10 bg-paper p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              What is inferred
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {project.uncertainties.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 font-mono text-xs text-ink-soft">
          Scale: not to scale. Every elevation is this cut list projected in
          space. Confirm plywood thickness before cutting dados.
        </p>
      </Sheet>

      <Sheet
        title="Your lumber"
        sheet="2"
        meta={`${packet.boards.reduce((s, b) => s + b.bdft, 0).toFixed(1)} nom. bd ft on the rack  ·  ${packet.boardFeet.toFixed(1)} net in the parts`}
      >
        <LumberSheet packet={packet} />
      </Sheet>

      <Sheet
        title="Cut list + every fastener"
        sheet="3"
        meta="Shop order is the page order. Fastener table is what to buy and where each one goes."
      >
        <CutListTable cuts={cuts} />
        <FastenerTable hardware={packet.hardware} />
      </Sheet>

      <Sheet
        title="Exploded assembly"
        sheet="4"
        meta={`${cuts.length} parts  ·  ${route.joinery}`}
      >
        <p className="mb-3 text-sm text-ink-soft">
          {isQuietRank(project.rank)
            ? "Letters on the explode match the legend. Assembly stays folded until you want the sequence — the iso is the drawing."
            : "Letters on the explode match the legend. Assembly sequence is under the drawing."}
        </p>
        <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
          <IsoScene boxes={exploded} rank={project.rank} />
          <Legend cuts={cuts} />
        </div>
        <AssemblyStepList key={project.rank} rank={project.rank} steps={packet.steps} />
      </Sheet>

      <Sheet
        title="Part tickets"
        sheet="5"
        meta={`${cuts.length} boards  ·  face, edge, and end  ·  ${packet.boardFeet.toFixed(1)} bd ft`}
      >
        <p className="mb-4 text-sm text-ink-soft">
          {project.rank === "beginner" || project.rank === "novice"
            ? "One ticket per board. Read the cut list and elevations first — then use these to check each board. Letter and size lead so seats, legs, and stretchers do not look the same."
            : "One ticket per board. Letter and size lead. The three views are that part at the size on the cut list. Lock a length and this ticket updates."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {cuts.map((cut) => (
            <PartTicket key={cut.id} cut={cut} />
          ))}
        </div>
      </Sheet>

      {lattice ? (
        <Sheet title="Joinery — lattice back" sheet="6" meta="Half-laps on the diamond">
          <LatticeJoinery />
        </Sheet>
      ) : feeder ? (
        <Sheet
          title="Joinery — posts, hips, resaw"
          sheet="6"
          meta="The two faces butt. They do not cross."
        >
          <FeederJoinery />
        </Sheet>
      ) : null}
    </div>
  );
}

function PhotoStrip({
  photos,
  fromPhotos,
}: {
  photos: string[];
  fromPhotos: boolean;
}) {
  if (!photos.length) return null;
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        {fromPhotos ? "Read from these photos" : "Reference"}
      </p>
      <ul className="mt-2 flex gap-2 overflow-x-auto">
        {photos.slice(0, 6).map((src, i) => (
          <li key={`${i}-${src.slice(-10)}`} className="shrink-0">
            <img
              src={src}
              alt={`Photo ${i + 1}`}
              className="h-16 w-16 rounded-sm object-cover sm:h-20 sm:w-24"
            />
            <p className="mt-1 text-center font-mono text-[10px] text-ink-soft">
              {i + 1}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sheet({
  title,
  sheet,
  meta,
  children,
}: {
  title: string;
  sheet: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <section className="break-inside-avoid rounded-md border border-ink/15 bg-paper-2/40 p-4 sm:p-5">
      <header className="mb-4 flex items-end justify-between gap-3 border-b border-ink/20 pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            Shopwright · shop drawing
          </p>
          <h3 className="mt-1 font-display text-xl text-ink">{title}</h3>
          <p className="mt-1 font-mono text-xs text-ink-soft">{meta}</p>
        </div>
        <p className="shrink-0 font-mono text-xs text-ink-soft">Sheet {sheet}</p>
      </header>
      {children}
    </section>
  );
}

function StackList({ stack }: { stack: string[] }) {
  if (!stack.length) return null;
  return (
    <div className="mb-5 rounded-sm border border-ink/15 bg-paper p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        Stack (locked)
      </p>
      <ul className="mt-2 columns-1 gap-x-8 text-sm sm:columns-2">
        {stack.map((line) => (
          <li key={line} className="break-inside-avoid py-0.5">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LumberSheet({ packet }: { packet: ShopPacket }) {
  const spare = packet.boards.filter((b) => b.spare);
  const work = packet.boards.filter((b) => !b.spare);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Cut the working boards first. Spare stays on the rack until you blow a
        cut. Net in the parts is {packet.boardFeet.toFixed(1)} bd ft.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {work.map((b) => (
          <li key={b.id} className="rounded-sm border border-ink/15 p-3">
            <p className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              <span>{b.label}</span>
              <span>
                {b.stock} · {b.bdft} nom. bd ft
              </span>
            </p>
            <p className="mt-1 text-sm font-medium">{b.role}</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">{b.yields}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b.body}</p>
          </li>
        ))}
      </ul>
      {spare.length ? (
        <p className="text-sm text-ink-soft">
          Spare on the rack: {spare.map((b) => `${b.label} ${b.stock}`).join(" · ")}.
          Do not cut until the working boards are done.
        </p>
      ) : null}
      {packet.stillBuy.length ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            Still buy
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            {packet.stillBuy.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {packet.doNotBuy.length ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            Do not buy
          </p>
          <p className="mt-2 text-sm text-ink-soft">{packet.doNotBuy.join(" · ")}</p>
        </div>
      ) : null}
    </div>
  );
}

function CutListTable({ cuts }: { cuts: CutRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-ink/20 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            <th className="py-2 pr-2 font-normal">#</th>
            <th className="py-2 pr-2 font-normal">Part</th>
            <th className="py-2 pr-2 font-normal">Qty</th>
            <th className="py-2 pr-2 font-normal">T</th>
            <th className="py-2 pr-2 font-normal">W</th>
            <th className="py-2 pr-2 font-normal">L</th>
            <th className="py-2 font-normal">From</th>
          </tr>
        </thead>
        <tbody>
          {cuts.map((c) => (
            <tr key={c.id} className="border-b border-ink/10 align-top">
              <td className="py-2 pr-2 font-mono">{c.letter}</td>
              <td className="py-2 pr-2">
                {c.name}
                {c.locked.length || c.locked.width || c.locked.thickness ? (
                  <span className="ml-1 text-xs text-ink-soft">locked</span>
                ) : null}
              </td>
              <td className="py-2 pr-2 font-mono">{c.qty}</td>
              <DimCell cut={c} axis="thickness" />
              <DimCell cut={c} axis="width" />
              <DimCell cut={c} axis="length" />
              <td className="py-2 text-ink-soft">{c.fromStock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DimCell({ cut, axis }: { cut: CutRow; axis: CutAxis }) {
  const source = formatCutAxisSource(cut, axis);
  return (
    <td className="py-2 pr-2 font-mono">
      <span className="block">{formatCutAxis(cut, axis)}</span>
      {source ? (
        <span className="mt-0.5 block font-sans text-[10px] font-normal leading-snug text-ink-soft">
          {source}
        </span>
      ) : null}
    </td>
  );
}

function FastenerTable({ hardware }: { hardware: HardwareItem[] }) {
  return (
    <div className="mt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        Fasteners — buy these, used here
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink/20 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              <th className="py-2 pr-2 font-normal">Buy</th>
              <th className="py-2 pr-2 font-normal">Qty</th>
              <th className="py-2 font-normal">Where they go</th>
            </tr>
          </thead>
          <tbody>
            {hardware.map((h) => (
              <tr key={h.id} className="border-b border-ink/10 align-top">
                <td className="py-2 pr-2">
                  <span className="block font-medium">{h.name}</span>
                  <span className="text-xs text-ink-soft">
                    {h.spec} · {h.aisle}
                  </span>
                </td>
                <td className="py-2 pr-2 font-mono">{h.qty}</td>
                <td className="py-2 text-ink-soft">{h.where ?? "See assembly."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Frame({
  label,
  worldW,
  worldH,
  xName,
  yName,
  children,
}: {
  label: string;
  worldW: number;
  worldH: number;
  xName: "W" | "D" | "H";
  yName: "W" | "D" | "H";
  children: (s: number, ox: number, oy: number) => ReactNode;
}) {
  const padX = 16;
  const padY = 18;
  const innerW = 100 - padX * 2;
  const innerH = 76 - padY;
  const s = Math.min(innerW / Math.max(worldW, 1), innerH / Math.max(worldH, 1));
  const dw = Math.max(worldW, 0.25) * s;
  const dh = Math.max(worldH, 0.25) * s;
  const ox = (100 - dw) / 2;
  const oy = 5 + (76 - dh) / 2;
  const xCall = elevationCallout(xName, worldW);
  const yCall = elevationCallout(yName, worldH);
  const xDash = xCall.unknown ? "1.6 1.2" : undefined;
  const yDash = yCall.unknown ? "1.6 1.2" : undefined;
  return (
    <figure>
      <svg viewBox="0 0 100 100" className="h-auto w-full" aria-hidden>
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          fill={PAPER}
          stroke={INK}
          strokeWidth="0.6"
        />
        {children(s, ox, oy)}
        <path
          d={`M ${ox} ${oy + dh + 4} L ${ox} ${oy + dh + 8} M ${ox + dw} ${oy + dh + 4} L ${ox + dw} ${oy + dh + 8} M ${ox} ${oy + dh + 6} L ${ox + dw} ${oy + dh + 6}`}
          stroke={INK}
          strokeWidth="0.55"
          strokeDasharray={xDash}
        />
        <path
          d={`M ${ox - 8} ${oy} L ${ox - 4} ${oy} M ${ox - 8} ${oy + dh} L ${ox - 4} ${oy + dh} M ${ox - 6} ${oy} L ${ox - 6} ${oy + dh}`}
          stroke={INK}
          strokeWidth="0.55"
          strokeDasharray={yDash}
        />
        <text
          x={ox + dw / 2}
          y={oy + dh + 13.2}
          textAnchor="middle"
          fontSize="5.6"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
        >
          {xCall.text}
        </text>
        <text
          x={ox - 10}
          y={oy + dh / 2}
          textAnchor="middle"
          fontSize="5.6"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
          transform={`rotate(-90 ${ox - 10} ${oy + dh / 2})`}
        >
          {yCall.text}
        </text>
      </svg>
      <figcaption className="mt-1 text-center font-mono text-xs text-ink-soft">
        {label}
      </figcaption>
    </figure>
  );
}

function fillFor(role: WorldBox["role"]) {
  if (role === "top" || role === "seat" || role === "shelf" || role === "roof") {
    return WOOD_DK;
  }
  if (role === "back" || role === "door" || role === "panel") return PAPER;
  return WOOD;
}

function ProjectedView({
  label,
  mode,
  boxes,
  overall,
}: {
  label: string;
  mode: "front" | "side" | "plan";
  boxes: WorldBox[];
  overall: Overall;
}) {
  const worldW = mode === "side" ? overall.d : overall.w;
  const worldH = mode === "plan" ? overall.d : overall.h;
  const { xName, yName } = elevationViewAxes(mode);
  const rects = boxes
    .map((b) => {
      if (mode === "front") {
        return {
          x: b.x,
          y: overall.h - b.z - b.h,
          w: b.w,
          h: b.h,
          depth: b.y,
          letter: b.letter,
          role: b.role,
          unknownW: !!b.unknown?.w,
          unknownH: !!b.unknown?.h,
        };
      }
      if (mode === "side") {
        return {
          x: b.y,
          y: overall.h - b.z - b.h,
          w: b.d,
          h: b.h,
          depth: -b.x,
          letter: b.letter,
          role: b.role,
          unknownW: !!b.unknown?.d,
          unknownH: !!b.unknown?.h,
        };
      }
      return {
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.d,
        depth: b.z,
        letter: b.letter,
        role: b.role,
        unknownW: !!b.unknown?.w,
        unknownH: !!b.unknown?.d,
      };
    })
    .filter((r) => r.unknownW || r.unknownH || (r.w > 0.04 && r.h > 0.04))
    .sort((a, b) => a.depth - b.depth);

  const labels = labelElevationParts(rects);

  return (
    <Frame label={label} worldW={worldW} worldH={worldH} xName={xName} yName={yName}>
      {(s, ox, oy) => (
        <g>
          {rects.map((r, i) => {
            const unknown = r.unknownW || r.unknownH;
            const rw = Math.max(r.w * s, 1.15);
            const rh = Math.max(r.h * s, 1.15);
            return (
              <g key={`${r.letter}-${i}`}>
                <rect
                  x={ox + r.x * s}
                  y={oy + r.y * s}
                  width={rw}
                  height={rh}
                  fill={unknown ? "none" : fillFor(r.role)}
                  stroke={INK}
                  strokeWidth="0.6"
                  strokeDasharray={unknown ? "2 1.4" : undefined}
                />
              </g>
            );
          })}
          {labels.map((r, i) => {
            const rw = Math.max(r.w * s, 1.15);
            const rh = Math.max(r.h * s, 1.15);
            const cx = ox + r.x * s + rw / 2;
            const cy = oy + r.y * s + rh / 2 + 1.5;
            const thinTall = r.beside && r.w <= r.h;
            const lx = thinTall ? ox + r.x * s + rw + 3.4 : cx;
            const ly = r.beside && !thinTall ? oy + r.y * s - 1.8 : cy;
            return (
              <text
                key={`lbl-${r.letter}-${i}`}
                x={lx}
                y={ly}
                textAnchor={thinTall ? "start" : "middle"}
                fontSize="4.6"
                fill={INK}
                fontFamily="IBM Plex Mono, monospace"
              >
                {r.letter}
              </text>
            );
          })}
        </g>
      )}
    </Frame>
  );
}

function isoRaw(x: number, y: number, z: number) {
  return { px: (x - y) * 0.866, py: -z * 0.9 + (x + y) * 0.5 };
}

function IsoScene({ boxes, rank }: { boxes: WorldBox[]; rank?: Rank }) {
  const VW = 240;
  const VH = 176;
  const quiet = isQuietRank(rank);
  if (!boxes.length) {
    return (
      <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" aria-hidden>
        <rect x="0.5" y="0.5" width={VW - 1} height={VH - 1} fill={PAPER} stroke={INK} strokeWidth="0.6" />
      </svg>
    );
  }
  const corners = boxes.flatMap((b) => {
    const pts = [];
    for (const dx of [0, b.w]) {
      for (const dy of [0, b.d]) {
        for (const dz of [0, b.h]) {
          pts.push(isoRaw(b.x + dx, b.y + dy, b.z + dz));
        }
      }
    }
    return pts;
  });
  const minX = Math.min(...corners.map((p) => p.px));
  const maxX = Math.max(...corners.map((p) => p.px));
  const minY = Math.min(...corners.map((p) => p.py));
  const maxY = Math.max(...corners.map((p) => p.py));
  const pad = 20;
  const s = Math.min(
    (VW - pad * 2) / Math.max(maxX - minX, 0.01),
    (VH - pad * 2) / Math.max(maxY - minY, 0.01),
  );
  const ox = (VW - (maxX - minX) * s) / 2 - minX * s;
  const oy = (VH - (maxY - minY) * s) / 2 - minY * s;
  const P = (x: number, y: number, z: number) => {
    const r = isoRaw(x, y, z);
    return `${(ox + r.px * s).toFixed(2)},${(oy + r.py * s).toFixed(2)}`;
  };
  const sorted = [...boxes].sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
  const anchors = sorted
    .filter((b) => isoShowsBadge(b.role, rank))
    .map((b) => {
      const [cx, cy] = P(b.x + b.w / 2, b.y + b.d / 2, b.z + b.h)
        .split(",")
        .map(Number);
      return { id: b.id, letter: b.letter, x: cx, y: cy - 6 };
    });
  const badges = separateBadges(anchors, 12);
  const fromId = new Map(anchors.map((a) => [a.id, a]));

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" aria-hidden>
      <rect x="0.5" y="0.5" width={VW - 1} height={VH - 1} fill={PAPER} stroke={INK} strokeWidth="0.6" />
      {sorted.map((b) => {
        const unknown = !!(b.unknown?.w || b.unknown?.d || b.unknown?.h);
        const dash = unknown ? "2.2 1.6" : undefined;
        const light = quiet && !isMajorShopPart(b.role);
        const strokeW = light ? 0.5 : 0.85;
        const p = (dx: number, dy: number, dz: number) => P(b.x + dx, b.y + dy, b.z + dz);
        const top = `${p(0, 0, b.h)} ${p(b.w, 0, b.h)} ${p(b.w, b.d, b.h)} ${p(0, b.d, b.h)}`;
        const right = `${p(b.w, 0, 0)} ${p(b.w, b.d, 0)} ${p(b.w, b.d, b.h)} ${p(b.w, 0, b.h)}`;
        const front = `${p(0, 0, 0)} ${p(b.w, 0, 0)} ${p(b.w, 0, b.h)} ${p(0, 0, b.h)}`;
        return (
          <g key={b.id}>
            <polygon points={right} fill={unknown || light ? "none" : WOOD_DK} stroke={INK} strokeWidth={strokeW} strokeDasharray={dash} />
            <polygon points={front} fill={unknown || light ? "none" : fillFor(b.role)} stroke={INK} strokeWidth={strokeW} strokeDasharray={dash} />
            <polygon points={top} fill={unknown || light ? "none" : PAPER} stroke={INK} strokeWidth={strokeW} strokeDasharray={dash} />
          </g>
        );
      })}
      {badges.map((badge) => {
        const from = fromId.get(badge.id);
        const moved =
          from && (Math.hypot(badge.x - from.x, badge.y - from.y) > 2.2);
        return (
          <g key={`badge-${badge.id}`}>
            {moved && from ? (
              <path
                d={`M ${from.x} ${from.y} L ${badge.x} ${badge.y}`}
                stroke={INK}
                strokeWidth="0.45"
              />
            ) : null}
            <circle cx={badge.x} cy={badge.y} r="5.2" fill={PAPER} stroke={INK} strokeWidth="0.75" />
            <text
              x={badge.x}
              y={badge.y + 1.8}
              textAnchor="middle"
              fontSize="5.2"
              fill={INK}
              fontFamily="IBM Plex Mono, monospace"
            >
              {badge.letter}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AssemblyStepList({
  rank,
  steps,
}: {
  rank: Rank;
  steps: ShopPacket["steps"];
}) {
  const [open, setOpen] = useState(() => assemblyStepsOpen(rank));
  if (!steps.length) return null;
  return (
    <details
      className="shop-assembly-steps mt-5 border-t border-ink/10 pt-3"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-mono text-xs text-ink-soft">
        Assembly steps · {steps.length}
        {assemblyStepsOpen(rank) ? "" : " — open when you are ready to build"}
      </summary>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.id} className="border-t border-ink/10 pt-2">
            <p className="font-mono text-[10px] text-ink-soft">
              {String(i + 1).padStart(2, "0")} · assembly
            </p>
            <p className="mt-0.5 text-sm font-medium">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Legend({ cuts }: { cuts: CutRow[] }) {
  return (
    <ol className="space-y-1.5 font-mono text-xs text-ink">
      {cuts.map((c) => (
        <li key={c.id} className="flex gap-2">
          <span className="w-6 shrink-0 text-ink-soft">{c.letter}</span>
          <span>
            <span className="block font-sans text-sm font-medium">{c.name}</span>
            <span className="text-ink-soft">
              {c.qty}× {formatCutTriplet(c)}
              {c.locked.length || c.locked.width || c.locked.thickness ? " · locked" : ""}
            </span>
            {formatCutSources(c) ? (
              <span className="mt-0.5 block text-[10px] leading-snug text-ink-soft">
                {formatCutSources(c)}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function BoardView({
  label,
  x,
  y,
  xName,
  yName,
  xLabel,
  yLabel,
  unknownX,
  unknownY,
  grain,
}: {
  label: string;
  x: number;
  y: number;
  xName: string;
  yName: string;
  xLabel: string;
  yLabel: string;
  unknownX?: boolean;
  unknownY?: boolean;
  grain?: "length" | "width" | false;
}) {
  // Hairline only — never a typical ¾" fill when the axis is unknown.
  const drawX = Math.max(x, unknownX ? 0.35 : 0.25);
  const drawY = Math.max(y, unknownY ? 0.35 : 0.25);
  const max = Math.max(drawX, drawY, 0.25);
  const w = (drawX / max) * 70;
  const h = Math.max((drawY / max) * 42, 8);
  const ox = (100 - w) / 2;
  const oy = (58 - h) / 2 + 2;
  const unknown = !!(unknownX || unknownY);
  return (
    <figure>
      <svg viewBox="0 0 100 72" className="h-auto w-full" aria-hidden>
        <rect
          x={ox}
          y={oy}
          width={w}
          height={h}
          fill={unknown ? "none" : "#e7dfcf"}
          stroke={INK}
          strokeWidth="1"
          strokeDasharray={unknown ? "2.4 1.6" : undefined}
        />
        {grain === "length" && !unknown ? (
          <path
            d={`M ${ox + 4} ${oy + h / 2} L ${ox + w - 4} ${oy + h / 2}`}
            stroke={INK}
            strokeWidth="0.4"
            strokeDasharray="1.5 1.2"
          />
        ) : grain === "width" && !unknown ? (
          <path
            d={`M ${ox + w / 2} ${oy + 3} L ${ox + w / 2} ${oy + h - 3}`}
            stroke={INK}
            strokeWidth="0.4"
            strokeDasharray="1.5 1.2"
          />
        ) : null}
        <path d={`M ${ox} ${oy + h + 6} L ${ox + w} ${oy + h + 6}`} stroke={INK} strokeWidth="0.5" />
        <path d={`M ${ox - 5} ${oy} L ${ox - 5} ${oy + h}`} stroke={INK} strokeWidth="0.5" />
        <text
          x={ox + w / 2}
          y={oy + h + 12}
          textAnchor="middle"
          fontSize="5.2"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
        >
          {xName} {xLabel}
        </text>
        <text
          x={Math.max(ox - 7, 5)}
          y={oy + h / 2}
          textAnchor="middle"
          fontSize="5.2"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
          transform={`rotate(-90 ${Math.max(ox - 7, 5)} ${oy + h / 2})`}
        >
          {yName} {yLabel}
        </text>
      </svg>
      <figcaption className="text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">
        {label}
      </figcaption>
    </figure>
  );
}

function PartTicket({ cut }: { cut: CutRow }) {
  const identity = ticketIdentity(cut);
  const locked = cut.locked.length || cut.locked.width || cut.locked.thickness;
  const face = ticketViewLabels(cut, "face");
  const edge = ticketViewLabels(cut, "edge");
  const end = ticketViewLabels(cut, "end");
  const sources = formatCutSources(cut);
  return (
    <article
      className="rounded-sm border border-ink/15 p-3"
      data-ticket-identity={identity.lead}
    >
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center border border-ink/25 bg-paper font-display text-2xl leading-none text-ink">
          {identity.letter}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-ink">{identity.name}</span>
            <span className="shrink-0 font-mono text-xs text-ink-soft">
              qty {cut.qty}
              {locked ? " · locked" : ""}
            </span>
          </p>
          <p className="mt-0.5 font-mono text-sm text-ink">{identity.dimLine}</p>
        </div>
      </header>
      {sources ? (
        <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{sources}</p>
      ) : null}
      <div className="mt-2 grid grid-cols-3 gap-1">
        <BoardView
          label="Face"
          x={cut.length}
          y={cut.width}
          xName="L"
          yName="W"
          xLabel={face.x}
          yLabel={face.y}
          unknownX={face.unknownX}
          unknownY={face.unknownY}
          grain={cut.grain}
        />
        <BoardView
          label="Edge"
          x={cut.length}
          y={cut.thickness}
          xName="L"
          yName="T"
          xLabel={edge.x}
          yLabel={edge.y}
          unknownX={edge.unknownX}
          unknownY={edge.unknownY}
        />
        <BoardView
          label="End"
          x={cut.width}
          y={cut.thickness}
          xName="W"
          yName="T"
          xLabel={end.x}
          yLabel={end.y}
          unknownX={end.unknownX}
          unknownY={end.unknownY}
        />
      </div>
      <p className="mt-2 font-mono text-xs text-ink-soft">
        {cut.stock}
        {cut.grain === "length" ? " · grain long" : " · grain across"}
      </p>
      <p className="mt-1 font-mono text-xs text-ink-soft">From {cut.fromStock}</p>
      {cut.notes ? <p className="mt-1 text-xs text-ink-soft">{cut.notes}</p> : null}
    </article>
  );
}

function FeederJoinery() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <figure>
        <svg viewBox="0 0 100 80" className="h-auto w-full" aria-hidden>
          <rect x="18" y="18" width="44" height="44" fill={WOOD_DK} stroke={INK} strokeWidth="1" />
          <rect x="58" y="22" width="8" height="14" fill={PAPER} stroke={INK} strokeWidth="0.8" />
          <rect x="22" y="10" width="14" height="8" fill={PAPER} stroke={INK} strokeWidth="0.8" />
          <text x="50" y="74" textAnchor="middle" fontSize="4" fill={INK} fontFamily="IBM Plex Mono, monospace">
            F 1×1 post · glue OUT · ¼×¼ grooves
          </text>
        </svg>
        <figcaption className="text-sm text-ink-soft">
          Glue line on the outside. Grooves in solid wood. ½" inner roundover. PETG 7×7 with ¼" radius notches.
        </figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 100 80" className="h-auto w-full" aria-hidden>
          <rect x="42" y="28" width="16" height="28" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
          <path d="M 18 18 L 42 36 L 42 62 L 18 48 Z" fill={WOOD} stroke={INK} strokeWidth="0.9" />
          <path d="M 82 18 L 58 36 L 58 62 L 82 48 Z" fill={WOOD} stroke={INK} strokeWidth="0.9" />
          <text x="50" y="74" textAnchor="middle" fontSize="4" fill={INK} fontFamily="IBM Plex Mono, monospace">
            Hip · edges butt · R cleat inside
          </text>
        </svg>
        <figcaption className="text-sm text-ink-soft">
          Two faces of ½" plywood cannot pass through each other. A hairline gap is fine. The ¾×¾ cleat is what holds the pyramid. Copper and the wooden cap cover the outside.
        </figcaption>
      </figure>
      <div className="sm:col-span-2 rounded-sm border border-ink/10 bg-paper p-3 text-sm leading-relaxed text-ink-soft">
        Resaw: board FLAT, fence 1¾", rip six strips. Then strip ON EDGE against a tall fence, two
        passes that meet in the middle, same face on the fence both times. ¾" minus ~⅛" kerf split
        in half is ~5/16". Do not stand the 1×12 on edge. Hang slats long, nail high, trim to the
        hip. They lap — they are not stacked end to end.
      </div>
    </div>
  );
}
