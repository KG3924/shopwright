import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { formatDimTriplet, formatInches } from "@/lib/format";
import { RANK_META } from "@/lib/ranks";
import type { CutRow, Project, ShopPacket } from "@/lib/types";
import { Button } from "./ui/button";

const INK = "var(--color-ink)";
const PAPER = "var(--color-paper)";
const WOOD = "var(--color-paper-2)";
const WOOD_DK = "#cfc3ab";

export function ShopDrawings({ packet }: { packet: ShopPacket }) {
  const { project, cuts, route, species } = packet;
  const overall = project.overall;
  const family = drawingFamily(project);

  return (
    <div className="shop-drawings space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="max-w-xl text-sm text-ink-soft">
          Shop drawings for this packet. Do not scale the pictures — cut to the
          numbers. Unlocked parts follow overall W / D / H; locked parts stay
          put. Print landscape if you take them to the saw.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="border-ink/20 text-ink hover:bg-ink/5"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          Print drawings
        </Button>
      </div>

      <Sheet
        title={project.name}
        sheet="1"
        meta={`${formatInches(overall.w)} W × ${formatInches(overall.d)} D × ${formatInches(overall.h)} H  ·  ${species.name}  ·  ${route.name}  ·  ${RANK_META[project.rank].label}`}
      >
        <p className="mb-4 max-w-2xl text-sm text-ink-soft">
          {project.interpretation}
        </p>
        <Elevations packet={packet} family={family} />
        <p className="mt-4 font-mono text-xs text-ink-soft">
          Scale: not to scale. Confirm plywood thickness before cutting dados.
          Grain on tops and shelves runs the length unless a part ticket says
          otherwise.
        </p>
      </Sheet>

      <Sheet
        title="Exploded assembly"
        sheet="2"
        meta={`${cuts.length} parts  ·  ${route.joinery}`}
      >
        <Exploded packet={packet} family={family} />
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {packet.steps.slice(0, 6).map((step, i) => (
            <li key={step.id} className="border-t border-ink/10 pt-2">
              <p className="font-mono text-[10px] text-ink-soft">
                {String(i + 1).padStart(2, "0")} · assembly
              </p>
              <p className="mt-0.5 text-sm font-medium">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Sheet>

      <Sheet
        title="Part tickets"
        sheet="3"
        meta={`${cuts.length} parts  ·  ${packet.boardFeet.toFixed(1)} bd ft  ·  ~${packet.weightLb} lb`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {cuts.map((cut, i) => (
            <PartTicket key={cut.id} cut={cut} index={i + 1} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function drawingFamily(project: Project): "table" | "case" | "chair" {
  const { category, id } = project;
  if (id === "adirondack" || category === "chair") return "chair";
  if (
    category === "bookcase" ||
    category === "cabinet" ||
    category === "case" ||
    id === "console" ||
    id === "bookcase" ||
    id === "cabinet"
  ) {
    return "case";
  }
  return "table";
}

function findCut(cuts: CutRow[], re: RegExp): CutRow | undefined {
  return cuts.find((c) => re.test(c.id) || re.test(c.name));
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

function Elevations({
  packet,
  family,
}: {
  packet: ShopPacket;
  family: "table" | "case" | "chair";
}) {
  const { project, cuts } = packet;
  const { w, d, h } = project.overall;
  if (family === "chair") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <ChairSide w={w} d={d} h={h} cuts={cuts} />
        <ChairFront w={w} h={h} cuts={cuts} />
        <PlanView w={w} d={d} family="chair" cuts={cuts} />
      </div>
    );
  }
  if (family === "case") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <CaseFront w={w} h={h} cuts={cuts} />
        <CaseSide d={d} h={h} cuts={cuts} />
        <PlanView w={w} d={d} family="case" cuts={cuts} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <TableFront w={w} h={h} cuts={cuts} />
      <TableSide d={d} h={h} cuts={cuts} />
      <PlanView w={w} d={d} family="table" cuts={cuts} />
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
  xName: string;
  yName: string;
  children: (s: number, ox: number, oy: number) => ReactNode;
}) {
  const padX = 14;
  const padY = 16;
  const innerW = 100 - padX * 2;
  const innerH = 78 - padY;
  const s = Math.min(innerW / Math.max(worldW, 1), innerH / Math.max(worldH, 1));
  const dw = worldW * s;
  const dh = worldH * s;
  const ox = (100 - dw) / 2;
  const oy = 6 + (78 - dh) / 2;
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
          d={`M ${ox} ${oy + dh + 6} L ${ox + dw} ${oy + dh + 6}`}
          stroke={INK}
          strokeWidth="0.55"
        />
        <path
          d={`M ${ox - 6} ${oy} L ${ox - 6} ${oy + dh}`}
          stroke={INK}
          strokeWidth="0.55"
        />
        <text
          x={ox + dw / 2}
          y={oy + dh + 12}
          textAnchor="middle"
          fontSize="5.4"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
        >
          {xName} {formatInches(worldW)}
        </text>
        <text
          x={ox - 8.5}
          y={oy + dh / 2}
          textAnchor="middle"
          fontSize="5.4"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
          transform={`rotate(-90 ${ox - 8.5} ${oy + dh / 2})`}
        >
          {yName} {formatInches(worldH)}
        </text>
      </svg>
      <figcaption className="mt-1 text-center font-mono text-xs text-ink-soft">
        {label}
      </figcaption>
    </figure>
  );
}

function TableFront({ w, h, cuts }: { w: number; h: number; cuts: CutRow[] }) {
  const top = findCut(cuts, /top/i);
  const leg = findCut(cuts, /(^leg$|\bleg\b)/i);
  const apron = findCut(cuts, /long apron|apron-l|front stretcher/i) ?? findCut(cuts, /apron/i);
  const topT = top?.thickness ?? 0.75;
  const legW = Math.min(leg?.width ?? 1.5, w / 6);
  const apronH = Math.min(apron?.width ?? 3.5, h / 2);
  return (
    <Frame label="Front" worldW={w} worldH={h} xName="W" yName="H">
      {(s, ox, oy) => {
        const topH = Math.max(topT * s, 2.4);
        const legPx = Math.max(legW * s, 3.2);
        const apronPx = Math.max(apronH * s, 6);
        return (
          <g>
            <rect x={ox} y={oy} width={w * s} height={topH} fill={WOOD_DK} stroke={INK} strokeWidth="0.8" />
            <rect x={ox} y={oy + topH} width={legPx} height={h * s - topH} fill={WOOD} stroke={INK} strokeWidth="0.7" />
            <rect
              x={ox + w * s - legPx}
              y={oy + topH}
              width={legPx}
              height={h * s - topH}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.7"
            />
            <rect
              x={ox + legPx}
              y={oy + topH}
              width={w * s - 2 * legPx}
              height={apronPx}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.7"
            />
          </g>
        );
      }}
    </Frame>
  );
}

function TableSide({ d, h, cuts }: { d: number; h: number; cuts: CutRow[] }) {
  const top = findCut(cuts, /top/i);
  const leg = findCut(cuts, /(^leg$|\bleg\b)/i);
  const apron = findCut(cuts, /short apron|apron-s/i) ?? findCut(cuts, /apron/i);
  const topT = top?.thickness ?? 0.75;
  const legW = Math.min(leg?.width ?? 1.5, d / 5);
  const apronH = Math.min(apron?.width ?? 3.5, h / 2);
  return (
    <Frame label="Side" worldW={d} worldH={h} xName="D" yName="H">
      {(s, ox, oy) => {
        const topH = Math.max(topT * s, 2.4);
        const legPx = Math.max(legW * s, 3.2);
        const apronPx = Math.max(apronH * s, 6);
        return (
          <g>
            <rect x={ox} y={oy} width={d * s} height={topH} fill={WOOD_DK} stroke={INK} strokeWidth="0.8" />
            <rect x={ox} y={oy + topH} width={legPx} height={h * s - topH} fill={WOOD} stroke={INK} strokeWidth="0.7" />
            <rect
              x={ox + d * s - legPx}
              y={oy + topH}
              width={legPx}
              height={h * s - topH}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.7"
            />
            <rect
              x={ox + legPx}
              y={oy + topH}
              width={d * s - 2 * legPx}
              height={apronPx}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.7"
            />
          </g>
        );
      }}
    </Frame>
  );
}

function CaseFront({ w, h, cuts }: { w: number; h: number; cuts: CutRow[] }) {
  const side = findCut(cuts, /side/i);
  const shelves = cuts.filter((c) => /shelf/i.test(c.name) || c.id === "shelf" || c.id === "tb" || /top|bottom/i.test(c.name));
  const kick = findCut(cuts, /kick/i);
  const t = side?.thickness ?? 0.75;
  const shelfT = shelves[0]?.thickness ?? 0.75;
  const kickH = kick?.width ?? 0;
  const n = Math.max(shelves.filter((s) => /shelf/i.test(s.name)).length, 1);
  return (
    <Frame label="Front" worldW={w} worldH={h} xName="W" yName="H">
      {(s, ox, oy) => {
        const inner = [];
        for (let i = 0; i < n; i++) {
          const y = oy + ((i + 1) / (n + 1)) * h * s;
          inner.push(
            <rect
              key={i}
              x={ox + t * s}
              y={y}
              width={(w - 2 * t) * s}
              height={shelfT * s}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.6"
            />,
          );
        }
        return (
          <g>
            <rect x={ox} y={oy} width={w * s} height={h * s} fill={WOOD} stroke={INK} strokeWidth="0.8" />
            <rect
              x={ox + t * s}
              y={oy + t * s}
              width={(w - 2 * t) * s}
              height={(h - 2 * t - kickH) * s}
              fill={PAPER}
              stroke={INK}
              strokeWidth="0.5"
            />
            {inner}
            {kickH ? (
              <rect
                x={ox + t * s}
                y={oy + (h - kickH) * s}
                width={(w - 2 * t) * s}
                height={kickH * s}
                fill={WOOD_DK}
                stroke={INK}
                strokeWidth="0.6"
              />
            ) : null}
          </g>
        );
      }}
    </Frame>
  );
}

function CaseSide({ d, h, cuts }: { d: number; h: number; cuts: CutRow[] }) {
  const t = findCut(cuts, /side/i)?.thickness ?? 0.75;
  const shelves = cuts.filter((c) => /shelf/i.test(c.name));
  const n = Math.max(shelves.length, 2);
  const shelfT = shelves[0]?.thickness ?? 0.75;
  return (
    <Frame label="Side" worldW={d} worldH={h} xName="D" yName="H">
      {(s, ox, oy) => (
        <g>
          <rect x={ox} y={oy} width={d * s} height={h * s} fill={WOOD} stroke={INK} strokeWidth="0.8" />
          {Array.from({ length: n }, (_, i) => {
            const y = oy + ((i + 1) / (n + 1)) * h * s;
            return (
              <rect
                key={i}
                x={ox}
                y={y}
                width={d * s * 0.92}
                height={shelfT * s}
                fill={WOOD_DK}
                stroke={INK}
                strokeWidth="0.5"
              />
            );
          })}
          <path
            d={`M ${ox + d * s * 0.92} ${oy} L ${ox + d * s * 0.92} ${oy + h * s}`}
            stroke={INK}
            strokeWidth="0.5"
            strokeDasharray="1.4 1"
          />
        </g>
      )}
    </Frame>
  );
}

function ChairSide({ w: _w, d, h, cuts }: { w: number; d: number; h: number; cuts: CutRow[] }) {
  void _w;
  void cuts;
  return (
    <Frame label="Side" worldW={d} worldH={h} xName="D" yName="H">
      {(s, ox, oy) => {
        const x0 = ox;
        const y0 = oy;
        const dw = d * s;
        const dh = h * s;
        const seatY = y0 + dh * 0.55;
        const seatX = x0 + dw * 0.12;
        const backX = x0 + dw * 0.72;
        return (
          <g fill={WOOD} stroke={INK} strokeWidth="0.7">
            <path d={`M ${seatX} ${y0 + dh} L ${seatX + dw * 0.08} ${seatY} L ${backX} ${seatY + dh * 0.08} L ${backX - dw * 0.06} ${y0 + dh} Z`} />
            <rect x={seatX + dw * 0.02} y={y0 + dh * 0.22} width={dw * 0.08} height={dh * 0.78} />
            <path d={`M ${backX - dw * 0.04} ${y0 + dh * 0.08} L ${backX + dw * 0.08} ${y0} L ${backX + dw * 0.16} ${y0 + dh * 0.06} L ${backX + dw * 0.04} ${y0 + dh * 0.16} Z`} />
            <rect x={seatX} y={seatY} width={dw * 0.62} height={dh * 0.06} fill={WOOD_DK} />
            <rect x={seatX + dw * 0.02} y={y0 + dh * 0.22} width={dw * 0.55} height={dh * 0.05} fill={WOOD_DK} />
          </g>
        );
      }}
    </Frame>
  );
}

function ChairFront({ w, h, cuts }: { w: number; h: number; cuts: CutRow[] }) {
  const arm = findCut(cuts, /arm/i);
  const slats = findCut(cuts, /back slat/i);
  const n = slats?.qty ?? 7;
  return (
    <Frame label="Front" worldW={w} worldH={h} xName="W" yName="H">
      {(s, ox, oy) => {
        const dw = w * s;
        const dh = h * s;
        const slatW = dw / (n + 3);
        const gap = slatW * 0.25;
        const slatsEl = [];
        for (let i = 0; i < n; i++) {
          const x = ox + dw * 0.18 + i * (slatW + gap);
          const extra = Math.sin((i / Math.max(n - 1, 1)) * Math.PI) * dh * 0.08;
          slatsEl.push(
            <rect
              key={i}
              x={x}
              y={oy + dh * 0.06 - extra}
              width={slatW}
              height={dh * 0.55 + extra}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.5"
            />,
          );
        }
        return (
          <g>
            {slatsEl}
            <rect x={ox} y={oy + dh * 0.22} width={dw} height={(arm?.thickness ?? 0.75) * s * 1.6} fill={WOOD_DK} stroke={INK} strokeWidth="0.6" />
            <rect x={ox + dw * 0.08} y={oy + dh * 0.55} width={dw * 0.84} height={dh * 0.08} fill={WOOD_DK} stroke={INK} strokeWidth="0.6" />
            <rect x={ox + dw * 0.08} y={oy + dh * 0.55} width={dw * 0.08} height={dh * 0.45} fill={WOOD} stroke={INK} strokeWidth="0.6" />
            <rect x={ox + dw * 0.84} y={oy + dh * 0.55} width={dw * 0.08} height={dh * 0.45} fill={WOOD} stroke={INK} strokeWidth="0.6" />
          </g>
        );
      }}
    </Frame>
  );
}

function PlanView({
  w,
  d,
  family,
  cuts,
}: {
  w: number;
  d: number;
  family: "table" | "case" | "chair";
  cuts: CutRow[];
}) {
  const leg = findCut(cuts, /(^leg$|\bleg\b)/i);
  const legW = Math.min(leg?.width ?? 1.5, Math.min(w, d) / 5);
  return (
    <Frame label="Plan (top)" worldW={w} worldH={d} xName="W" yName="D">
      {(s, ox, oy) => {
        const legPx = Math.max(legW * s, 4);
        return (
        <g>
          <rect x={ox} y={oy} width={w * s} height={d * s} fill={WOOD} stroke={INK} strokeWidth="0.8" />
          {family === "table"
            ? (
              <>
                <rect x={ox} y={oy} width={legPx} height={legPx} fill={WOOD_DK} stroke={INK} strokeWidth="0.5" />
                <rect x={ox + w * s - legPx} y={oy} width={legPx} height={legPx} fill={WOOD_DK} stroke={INK} strokeWidth="0.5" />
                <rect x={ox} y={oy + d * s - legPx} width={legPx} height={legPx} fill={WOOD_DK} stroke={INK} strokeWidth="0.5" />
                <rect
                  x={ox + w * s - legPx}
                  y={oy + d * s - legPx}
                  width={legPx}
                  height={legPx}
                  fill={WOOD_DK}
                  stroke={INK}
                  strokeWidth="0.5"
                />
              </>
            )
            : family === "case"
              ? (
                <path
                  d={`M ${ox + 2} ${oy + 2} L ${ox + w * s - 2} ${oy + 2}`}
                  stroke={INK}
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1"
                />
              )
              : (
                <ellipse
                  cx={ox + w * s * 0.5}
                  cy={oy + d * s * 0.55}
                  rx={w * s * 0.38}
                  ry={d * s * 0.28}
                  fill="none"
                  stroke={INK}
                  strokeWidth="0.5"
                  strokeDasharray="1.4 1"
                />
              )}
        </g>
        );
      }}
    </Frame>
  );
}

function Exploded({
  packet,
  family,
}: {
  packet: ShopPacket;
  family: "table" | "case" | "chair";
}) {
  const { project, cuts } = packet;
  const { w, d, h } = project.overall;
  if (family === "chair") {
    return <ChairExploded cuts={cuts} w={w} d={d} h={h} />;
  }
  if (family === "case") {
    return <CaseExploded cuts={cuts} w={w} d={d} h={h} />;
  }
  return <TableExploded cuts={cuts} w={w} d={d} h={h} />;
}

function isoRaw(x: number, y: number, z: number) {
  return { px: (x - y) * 0.866, py: -z * 0.9 + (x + y) * 0.5 };
}

type IsoSpec = {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  mark?: string;
};

function IsoScene({ boxes }: { boxes: IsoSpec[] }) {
  const VW = 240;
  const VH = 176;
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

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" aria-hidden>
      <rect x="0.5" y="0.5" width={VW - 1} height={VH - 1} fill={PAPER} stroke={INK} strokeWidth="0.6" />
      {sorted.map((b, i) => {
        const p = (dx: number, dy: number, dz: number) => P(b.x + dx, b.y + dy, b.z + dz);
        const top = `${p(0, 0, b.h)} ${p(b.w, 0, b.h)} ${p(b.w, b.d, b.h)} ${p(0, b.d, b.h)}`;
        const right = `${p(b.w, 0, 0)} ${p(b.w, b.d, 0)} ${p(b.w, b.d, b.h)} ${p(b.w, 0, b.h)}`;
        const front = `${p(0, 0, 0)} ${p(b.w, 0, 0)} ${p(b.w, 0, b.h)} ${p(0, 0, b.h)}`;
        const [cx, cy] = P(b.x + b.w / 2, b.y + b.d / 2, b.z + b.h)
          .split(",")
          .map(Number);
        return (
          <g key={`${b.mark ?? "p"}-${i}`}>
            <polygon points={right} fill={WOOD_DK} stroke={INK} strokeWidth="0.85" />
            <polygon points={front} fill={WOOD} stroke={INK} strokeWidth="0.85" />
            <polygon points={top} fill={PAPER} stroke={INK} strokeWidth="0.85" />
            {b.mark ? (
              <g>
                <circle cx={cx} cy={cy - 6} r="5.4" fill={PAPER} stroke={INK} strokeWidth="0.8" />
                <text
                  x={cx}
                  y={cy - 4}
                  textAnchor="middle"
                  fontSize="5.2"
                  fill={INK}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {b.mark}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function TableExploded({
  cuts,
  w,
  d,
  h,
}: {
  cuts: CutRow[];
  w: number;
  d: number;
  h: number;
}) {
  const top = findCut(cuts, /top/i);
  const leg = findCut(cuts, /(^leg$|\bleg\b)/i);
  const apronL = findCut(cuts, /long apron|apron-l/i) ?? findCut(cuts, /apron/i);
  const apronS = findCut(cuts, /short apron|apron-s/i);
  const topT = top?.thickness ?? 0.75;
  const legW = Math.min(leg?.width ?? 1.5, w / 8);
  const apronH = Math.min(apronL?.width ?? 3.5, h / 2);
  const apronT = apronL?.thickness ?? 0.75;
  const explode = Math.max(w, d, h) * 0.22;
  const idx = (id?: string) => {
    const i = cuts.findIndex((c) => c.id === id);
    return i >= 0 ? String(i + 1).padStart(2, "0") : undefined;
  };
  const boxes: IsoSpec[] = [
    { x: -explode * 0.2, y: -explode * 0.2, z: 0, w: legW, d: legW, h: h - topT, mark: idx(leg?.id) },
    { x: w - legW + explode * 0.2, y: -explode * 0.2, z: 0, w: legW, d: legW, h: h - topT },
    { x: -explode * 0.2, y: d - legW + explode * 0.2, z: 0, w: legW, d: legW, h: h - topT },
    { x: w - legW + explode * 0.2, y: d - legW + explode * 0.2, z: 0, w: legW, d: legW, h: h - topT },
    {
      x: legW,
      y: 0,
      z: h - topT - apronH,
      w: w - 2 * legW,
      d: apronT,
      h: apronH,
      mark: idx(apronL?.id),
    },
    { x: legW, y: d - apronT, z: h - topT - apronH, w: w - 2 * legW, d: apronT, h: apronH },
  ];
  if (apronS) {
    boxes.push(
      {
        x: 0,
        y: legW,
        z: h - topT - apronH,
        w: apronT,
        d: d - 2 * legW,
        h: apronH,
        mark: idx(apronS.id),
      },
      { x: w - apronT, y: legW, z: h - topT - apronH, w: apronT, d: d - 2 * legW, h: apronH },
    );
  }
  boxes.push({
    x: 0,
    y: 0,
    z: h + explode * 0.55,
    w: w,
    d: d,
    h: topT,
    mark: idx(top?.id),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
      <IsoScene boxes={boxes} />
      <Legend cuts={cuts} />
    </div>
  );
}

function CaseExploded({
  cuts,
  w,
  d,
  h,
}: {
  cuts: CutRow[];
  w: number;
  d: number;
  h: number;
}) {
  const side = findCut(cuts, /side/i);
  const top = findCut(cuts, /^top$|\btop\b/i);
  const shelf = findCut(cuts, /shelf/i);
  const back = findCut(cuts, /back/i);
  const t = side?.thickness ?? 0.75;
  const explode = Math.max(w, h) * 0.16;
  const idx = (id?: string) => {
    const i = cuts.findIndex((c) => c.id === id);
    return i >= 0 ? String(i + 1).padStart(2, "0") : undefined;
  };
  const nShelves = Math.min(shelf?.qty ?? 3, 5);
  const boxes: IsoSpec[] = [
    { x: -explode, y: 0, z: 0, w: t, d: d, h: h, mark: idx(side?.id) },
    { x: w - t + explode, y: 0, z: 0, w: t, d: d, h: h },
    {
      x: t,
      y: 0,
      z: h - (top?.thickness ?? 0.75) + explode * 0.5,
      w: w - 2 * t,
      d: d,
      h: top?.thickness ?? 0.75,
      mark: idx(top?.id),
    },
  ];
  for (let i = 0; i < nShelves; i++) {
    boxes.push({
      x: t,
      y: explode * 0.12 * i,
      z: ((i + 1) / (nShelves + 1)) * (h - 2),
      w: w - 2 * t,
      d: d * 0.92,
      h: shelf?.thickness ?? 0.75,
      mark: i === 0 ? idx(shelf?.id) : undefined,
    });
  }
  if (back) {
    boxes.push({
      x: t,
      y: d + explode * 0.45,
      z: 0,
      w: w - 2 * t,
      d: Math.max(back.thickness, 0.4),
      h: h,
      mark: idx(back.id),
    });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
      <IsoScene boxes={boxes} />
      <Legend cuts={cuts} />
    </div>
  );
}

function ChairExploded({
  cuts,
  w,
  d,
  h,
}: {
  cuts: CutRow[];
  w: number;
  d: number;
  h: number;
}) {
  void h;
  const boxes: IsoSpec[] = cuts.slice(0, 8).map((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      x: col * (Math.min(c.length, w * 0.5) + 3),
      y: row * (Math.min(c.width, d * 0.4) + 3),
      z: 0,
      w: Math.min(c.length, w * 0.48),
      d: Math.max(Math.min(c.width, 6), 1.5),
      h: Math.max(c.thickness * 4, 1.2),
      mark: String(i + 1).padStart(2, "0"),
    };
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
      <IsoScene boxes={boxes} />
      <Legend cuts={cuts} />
    </div>
  );
}

function Legend({ cuts }: { cuts: CutRow[] }) {
  return (
    <ol className="space-y-1.5 font-mono text-xs text-ink">
      {cuts.map((c, i) => (
        <li key={c.id} className="flex gap-2">
          <span className="w-6 shrink-0 text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
          <span>
            <span className="block font-sans text-sm font-medium">{c.name}</span>
            <span className="text-ink-soft">
              {c.qty}× {formatDimTriplet(c.length, c.width, c.thickness)}
              {c.locked.length || c.locked.width || c.locked.thickness ? " · locked" : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function PartTicket({ cut, index }: { cut: CutRow; index: number }) {
  const max = Math.max(cut.length, cut.width, 1);
  const w = (cut.length / max) * 78 + 8;
  const h = Math.max((cut.width / max) * 32, 10);
  const ox = (100 - w) / 2;
  const oy = (50 - h) / 2 + 4;
  const locked = cut.locked.length || cut.locked.width || cut.locked.thickness;
  return (
    <article className="rounded-sm border border-ink/15 p-3">
      <p className="flex items-baseline justify-between gap-2 font-mono text-xs text-ink-soft">
        <span>P{String(index).padStart(2, "0")}</span>
        <span>
          qty {cut.qty}
          {locked ? " · locked" : ""}
        </span>
      </p>
      <h4 className="mt-1 font-medium text-ink">{cut.name}</h4>
      <svg viewBox="0 0 100 62" className="mt-2 h-auto w-full" aria-hidden>
        <rect x={ox} y={oy} width={w} height={h} fill="#e7dfcf" stroke={INK} strokeWidth="1" />
        {cut.grain === "length" ? (
          <path
            d={`M ${ox + 4} ${oy + h / 2} L ${ox + w - 4} ${oy + h / 2}`}
            stroke={INK}
            strokeWidth="0.4"
            strokeDasharray="1.5 1.2"
          />
        ) : (
          <path
            d={`M ${ox + w / 2} ${oy + 3} L ${ox + w / 2} ${oy + h - 3}`}
            stroke={INK}
            strokeWidth="0.4"
            strokeDasharray="1.5 1.2"
          />
        )}
        <text
          x={ox + w / 2}
          y={oy + h + 8}
          textAnchor="middle"
          fontSize="5.5"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
        >
          L {formatInches(cut.length)}
        </text>
        <text
          x={Math.max(ox - 4, 6)}
          y={oy + h / 2}
          textAnchor="middle"
          fontSize="5.5"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
          transform={`rotate(-90 ${Math.max(ox - 4, 6)} ${oy + h / 2})`}
        >
          W {formatInches(cut.width)}
        </text>
      </svg>
      <p className="mt-1 font-mono text-xs text-ink">
        {formatDimTriplet(cut.length, cut.width, cut.thickness)} · {cut.stock}
        {cut.grain === "length" ? " · grain long" : " · grain across"}
      </p>
      {cut.notes ? <p className="mt-1 text-xs text-ink-soft">{cut.notes}</p> : null}
    </article>
  );
}
