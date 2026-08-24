import type { DrawingSpec, PolyPt } from "./types";

const SHAPES: DrawingSpec["seatShape"][] = [
  "square",
  "round",
  "horseshoe",
  "D",
  "shield",
  "trapezoid",
  "rounded-rect",
  "irregular",
];
const PROFILES: NonNullable<DrawingSpec["seatProfile"]>[] = [
  "flat",
  "saddled",
  "dished",
  "scooped",
  "waterfall",
  "tractor",
  "sculpted",
];
const FRONTS: NonNullable<DrawingSpec["seatFront"]>[] = [
  "square",
  "rounded",
  "waterfall",
  "rolled",
  "bullnose",
];
const LEGS: NonNullable<DrawingSpec["legStyle"]>[] = [
  "straight",
  "tapered",
  "splayed",
  "tapered-splay",
  "cabriole",
  "saber",
  "turned",
];
const BACKS: NonNullable<DrawingSpec["backProfile"]>[] = [
  "upright",
  "reclined",
  "curved",
  "hoop",
  "windsor",
  "ladder",
];

export function asSeatShape(v: string | undefined): DrawingSpec["seatShape"] | undefined {
  return v && (SHAPES as string[]).includes(v) ? (v as DrawingSpec["seatShape"]) : undefined;
}
export function asSeatProfile(v: string | undefined): DrawingSpec["seatProfile"] | undefined {
  return v && (PROFILES as string[]).includes(v) ? (v as DrawingSpec["seatProfile"]) : undefined;
}
export function asSeatFront(v: string | undefined): DrawingSpec["seatFront"] | undefined {
  return v && (FRONTS as string[]).includes(v) ? (v as DrawingSpec["seatFront"]) : undefined;
}
export function asLegStyle(v: string | undefined): DrawingSpec["legStyle"] | undefined {
  return v && (LEGS as string[]).includes(v) ? (v as DrawingSpec["legStyle"]) : undefined;
}
export function asBackProfile(v: string | undefined): DrawingSpec["backProfile"] | undefined {
  return v && (BACKS as string[]).includes(v) ? (v as DrawingSpec["backProfile"]) : undefined;
}

export function sanitizeOutline(raw: unknown): PolyPt[] | undefined {
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  const pts: PolyPt[] = [];
  for (const p of raw.slice(0, 32)) {
    if (Array.isArray(p) && p.length >= 2) {
      const x = Number(p[0]);
      const y = Number(p[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pts.push({ x: clamp01(x), y: clamp01(y) });
      }
    } else if (p && typeof p === "object") {
      const x = Number((p as { x?: unknown }).x);
      const y = Number((p as { y?: unknown }).y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pts.push({ x: clamp01(x), y: clamp01(y) });
      }
    }
  }
  return pts.length >= 3 ? pts : undefined;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function hasShapedForm(spec: DrawingSpec): boolean {
  if (spec.sideOutline?.length || spec.frontOutline?.length || spec.planOutline?.length) {
    return true;
  }
  if (spec.seatProfile && spec.seatProfile !== "flat") return true;
  if (spec.seatShape && spec.seatShape !== "square") return true;
  if (spec.seatFront && spec.seatFront !== "square") return true;
  if (spec.legStyle && spec.legStyle !== "straight") return true;
  if (spec.backProfile && spec.backProfile !== "upright" && spec.backProfile !== "ladder") {
    return true;
  }
  if (spec.reclined) return true;
  return false;
}

export function outlineFor(
  mode: "front" | "side" | "plan",
  spec: DrawingSpec,
): PolyPt[] | undefined {
  if (mode === "side") return spec.sideOutline?.length ? spec.sideOutline : generateSide(spec);
  if (mode === "front") return spec.frontOutline?.length ? spec.frontOutline : generateFront(spec);
  return spec.planOutline?.length ? spec.planOutline : generatePlan(spec);
}

function generatePlan(spec: DrawingSpec): PolyPt[] | undefined {
  const shape = spec.seatShape ?? "square";
  if (shape === "round") {
    return Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + 0.46 * Math.cos(a), y: 0.5 + 0.46 * Math.sin(a) };
    });
  }
  if (shape === "horseshoe") {
    return [
      { x: 0.12, y: 0.04 },
      { x: 0.88, y: 0.04 },
      { x: 0.98, y: 0.22 },
      { x: 0.96, y: 0.62 },
      { x: 0.78, y: 0.96 },
      { x: 0.5, y: 1 },
      { x: 0.22, y: 0.96 },
      { x: 0.04, y: 0.62 },
      { x: 0.02, y: 0.22 },
    ];
  }
  if (shape === "D") {
    return [
      { x: 0.06, y: 0.04 },
      { x: 0.94, y: 0.04 },
      { x: 0.98, y: 0.2 },
      { x: 0.9, y: 0.92 },
      { x: 0.5, y: 0.98 },
      { x: 0.1, y: 0.92 },
      { x: 0.02, y: 0.2 },
    ];
  }
  if (shape === "shield") {
    return [
      { x: 0.18, y: 0.04 },
      { x: 0.82, y: 0.04 },
      { x: 0.98, y: 0.28 },
      { x: 0.72, y: 0.98 },
      { x: 0.5, y: 1 },
      { x: 0.28, y: 0.98 },
      { x: 0.02, y: 0.28 },
    ];
  }
  if (shape === "trapezoid") {
    return [
      { x: 0.16, y: 0.04 },
      { x: 0.84, y: 0.04 },
      { x: 0.98, y: 0.96 },
      { x: 0.02, y: 0.96 },
    ];
  }
  if (shape === "rounded-rect" || spec.seatFront === "rounded" || spec.seatFront === "bullnose") {
    return [
      { x: 0.08, y: 0.04 },
      { x: 0.92, y: 0.04 },
      { x: 1, y: 0.14 },
      { x: 1, y: 0.88 },
      { x: 0.92, y: 0.98 },
      { x: 0.08, y: 0.98 },
      { x: 0, y: 0.88 },
      { x: 0, y: 0.14 },
    ];
  }
  if (shape === "irregular") return undefined;
  return undefined;
}

function generateSide(spec: DrawingSpec): PolyPt[] | undefined {
  if (!hasShapedForm(spec) && spec.family !== "chair") return undefined;
  const sh = spec.seatHeightRatio ?? (spec.family === "chair" ? 0.48 : 0.75);
  const dish =
    spec.seatProfile === "tractor"
      ? 0.06
      : spec.seatProfile === "saddled" || spec.seatProfile === "sculpted"
        ? 0.04
        : spec.seatProfile === "dished" || spec.seatProfile === "scooped"
          ? 0.03
          : 0;
  const water =
    spec.seatFront === "waterfall" ||
    spec.seatFront === "rolled" ||
    spec.seatProfile === "waterfall";
  const recline = spec.reclined || spec.backProfile === "reclined";
  const curvedBack =
    spec.backProfile === "curved" ||
    spec.backProfile === "hoop" ||
    spec.backProfile === "windsor";
  const splay =
    spec.legStyle === "splayed" ||
    spec.legStyle === "tapered-splay" ||
    spec.legStyle === "saber" ||
    spec.legStyle === "cabriole"
      ? 0.06
      : 0.02;
  const backTop = recline ? 0.92 : curvedBack ? 0.9 : 0.82;
  const backX = recline ? 0.88 : curvedBack ? 0.8 : 0.76;
  const frontSeat = water ? sh - 0.04 : sh;
  const midSeat = sh - dish;
  const rearSeat = sh + (recline ? 0.04 : 0.01);

  if (spec.family !== "chair" && !hasShapedForm(spec)) return undefined;

  return [
    { x: 0.1 + splay, y: 0 },
    { x: 0.12, y: frontSeat - 0.02 },
    { x: water ? 0.02 : 0.06, y: frontSeat },
    { x: 0.18, y: midSeat + (spec.seatProfile === "saddled" ? 0.02 : 0) },
    { x: 0.42, y: midSeat },
    { x: 0.62, y: rearSeat },
    { x: backX - 0.04, y: rearSeat + 0.02 },
    { x: backX, y: 0.72 },
    { x: recline ? 0.96 : curvedBack ? 0.86 : backX + 0.02, y: 0.98 },
    { x: recline ? 1 : 0.94, y: 0.98 },
    { x: backX + 0.08, y: 0.7 },
    { x: 0.78, y: 0.08 },
    { x: 0.7 + splay, y: 0 },
  ];
}

function generateFront(spec: DrawingSpec): PolyPt[] | undefined {
  if (spec.family !== "chair" && !hasShapedForm(spec)) return undefined;
  const sh = spec.seatHeightRatio ?? 0.48;
  const splay =
    spec.legStyle === "splayed" || spec.legStyle === "tapered-splay" ? 0.08 : 0.03;
  const taper = spec.legStyle === "tapered" || spec.legStyle === "tapered-splay";
  const crest =
    spec.backProfile === "hoop" || spec.backProfile === "windsor"
      ? 0.18
      : spec.backStyle === "splat"
        ? 0.22
        : 0.16;
  const topY = 0.98;
  const seatY = sh;
  const footIn = taper ? splay + 0.02 : splay;
  return [
    { x: 0.12 - splay, y: 0 },
    { x: 0.16, y: seatY - 0.02 },
    { x: 0.04, y: seatY },
    { x: 0.96, y: seatY },
    { x: 0.84, y: seatY - 0.02 },
    { x: 0.88 + splay, y: 0 },
    { x: 0.88 + splay - 0.06, y: 0 },
    { x: 0.78, y: seatY - 0.04 },
    { x: 0.78, y: 0.7 },
    { x: 0.5 + crest / 2, y: topY },
    { x: 0.5, y: spec.backProfile === "hoop" ? 1 : 0.96 },
    { x: 0.5 - crest / 2, y: topY },
    { x: 0.22, y: 0.7 },
    { x: 0.22, y: seatY - 0.04 },
    { x: 0.18 + (taper ? 0.04 : 0), y: 0 },
    { x: 0.12 - splay + footIn, y: 0 },
  ];
}

export function svgPath(
  pts: PolyPt[],
  ox: number,
  oy: number,
  scaleX: number,
  scaleY: number,
  invertY: boolean,
  close: boolean,
): string {
  const xy = (p: PolyPt) => {
    const x = ox + p.x * scaleX;
    const y = invertY ? oy + (1 - p.y) * scaleY : oy + p.y * scaleY;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xy(p)}`)
    .join(" ");
  return close ? `${d} Z` : d;
}
