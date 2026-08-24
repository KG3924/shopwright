import type {
  BackProfile,
  DrawingSpec,
  LegStyle,
  PolyPt,
  SeatFront,
  SeatProfile,
  SeatShape,
} from "./types";

const SHAPES: SeatShape[] = [
  "square",
  "round",
  "horseshoe",
  "D",
  "shield",
  "trapezoid",
  "rounded-rect",
  "irregular",
];
const PROFILES: SeatProfile[] = [
  "flat",
  "saddled",
  "dished",
  "scooped",
  "waterfall",
  "tractor",
  "sculpted",
];
const FRONTS: SeatFront[] = ["square", "rounded", "waterfall", "rolled", "bullnose"];
const LEGS: LegStyle[] = [
  "straight",
  "tapered",
  "splayed",
  "tapered-splay",
  "cabriole",
  "saber",
  "turned",
];
const BACKS: BackProfile[] = ["upright", "reclined", "curved", "hoop", "windsor", "ladder"];

const PROFILE_ALIAS: Record<string, SeatProfile> = {
  flat: "flat",
  saddled: "saddled",
  saddle: "saddled",
  "saddle-seat": "saddled",
  "saddle-shaped": "saddled",
  dished: "dished",
  dish: "dished",
  scooped: "scooped",
  scoop: "scooped",
  waterfall: "waterfall",
  tractor: "tractor",
  "tractor-seat": "tractor",
  sculpted: "sculpted",
  contoured: "sculpted",
  carved: "sculpted",
  shaped: "sculpted",
};
const SHAPE_ALIAS: Record<string, SeatShape> = {
  square: "square",
  round: "round",
  circular: "round",
  oval: "round",
  horseshoe: "horseshoe",
  "horse-shoe": "horseshoe",
  d: "D",
  "d-shaped": "D",
  shield: "shield",
  trapezoid: "trapezoid",
  trapezoidal: "trapezoid",
  "rounded-rect": "rounded-rect",
  "rounded-rectangle": "rounded-rect",
  "round-rect": "rounded-rect",
  irregular: "irregular",
};
const FRONT_ALIAS: Record<string, SeatFront> = {
  square: "square",
  rounded: "rounded",
  eased: "rounded",
  waterfall: "waterfall",
  rolled: "rolled",
  "round-over": "rolled",
  bullnose: "bullnose",
};
const LEG_ALIAS: Record<string, LegStyle> = {
  straight: "straight",
  tapered: "tapered",
  taper: "tapered",
  splayed: "splayed",
  splay: "splayed",
  "tapered-splay": "tapered-splay",
  "tapered-splayed": "tapered-splay",
  cabriole: "cabriole",
  saber: "saber",
  sabre: "saber",
  turned: "turned",
};
const BACK_ALIAS: Record<string, BackProfile> = {
  upright: "upright",
  reclined: "reclined",
  curved: "curved",
  hoop: "hoop",
  windsor: "windsor",
  ladder: "ladder",
};

function keyOf(v: string): string {
  return v.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

export function asSeatShape(v: string | undefined | null): SeatShape | undefined {
  if (!v) return undefined;
  const k = keyOf(v);
  if ((SHAPES as string[]).includes(k === "d" ? "D" : k)) {
    return (k === "d" ? "D" : k) as SeatShape;
  }
  return SHAPE_ALIAS[k];
}
export function asSeatProfile(v: string | undefined | null): SeatProfile | undefined {
  if (!v) return undefined;
  const k = keyOf(v);
  if ((PROFILES as string[]).includes(k)) return k as SeatProfile;
  return PROFILE_ALIAS[k];
}
export function asSeatFront(v: string | undefined | null): SeatFront | undefined {
  if (!v) return undefined;
  const k = keyOf(v);
  if ((FRONTS as string[]).includes(k)) return k as SeatFront;
  return FRONT_ALIAS[k];
}
export function asLegStyle(v: string | undefined | null): LegStyle | undefined {
  if (!v) return undefined;
  const k = keyOf(v);
  if ((LEGS as string[]).includes(k)) return k as LegStyle;
  return LEG_ALIAS[k];
}
export function asBackProfile(v: string | undefined | null): BackProfile | undefined {
  if (!v) return undefined;
  const k = keyOf(v);
  if ((BACKS as string[]).includes(k)) return k as BackProfile;
  return BACK_ALIAS[k];
}

function parseOutlinePts(raw: unknown): PolyPt[] | undefined {
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

export function sanitizeOutline(raw: unknown): PolyPt[] | undefined {
  return honestOutline(parseOutlinePts(raw));
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

type BBox = { minX: number; maxX: number; minY: number; maxY: number };

function bboxOf(pts: PolyPt[]): BBox {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function uniquifyPts(pts: PolyPt[]): PolyPt[] {
  const uniq: PolyPt[] = [];
  for (const p of pts) {
    const last = uniq[uniq.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.01) uniq.push(p);
  }
  if (
    uniq.length >= 2 &&
    Math.hypot(uniq[0]!.x - uniq[uniq.length - 1]!.x, uniq[0]!.y - uniq[uniq.length - 1]!.y) < 0.01
  ) {
    uniq.pop();
  }
  return uniq;
}

function shoelaceArea(pts: PolyPt[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function isSlashSegment(a: PolyPt, b: PolyPt, box: BBox): boolean {
  const bw = Math.max(box.maxX - box.minX, 0.001);
  const bh = Math.max(box.maxY - box.minY, 0.001);
  const diag = Math.hypot(bw, bh);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (len < 0.38 * diag) return false;
  if (dx < 0.16 * bw || dy < 0.16 * bh) return false;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const edge =
    Math.min(mx - box.minX, box.maxX - mx) < 0.07 * bw ||
    Math.min(my - box.minY, box.maxY - my) < 0.07 * bh;
  if (edge) return false;
  return true;
}

function dropSlashSegments(pts: PolyPt[]): PolyPt[] {
  if (pts.length < 4) return pts;
  const box = bboxOf(pts);
  const out: PolyPt[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1]!;
    const p = pts[i]!;
    if (isSlashSegment(a, p, box)) continue;
    out.push(p);
  }
  if (out.length >= 2 && isSlashSegment(out[out.length - 1]!, out[0]!, box)) {
    out.pop();
  }
  return out;
}

function alignOutlineToOverall(pts: PolyPt[]): PolyPt[] {
  const b = bboxOf(pts);
  const spanX = b.maxX - b.minX;
  const spanY = b.maxY - b.minY;
  if (spanX < 0.2 || spanY < 0.2) return pts;
  const cameraCrop =
    b.minX > 0.08 &&
    1 - b.maxX > 0.08 &&
    b.minY > 0.08 &&
    1 - b.maxY > 0.08;
  if (!cameraCrop) return pts;
  return pts.map((p) => ({
    x: (p.x - b.minX) / spanX,
    y: (p.y - b.minY) / spanY,
  }));
}

function isJunkOutline(pts: PolyPt[]): boolean {
  const uniq = uniquifyPts(pts);
  if (uniq.length < 3) return true;
  const box = bboxOf(uniq);
  const spanX = box.maxX - box.minX;
  const spanY = box.maxY - box.minY;
  if (spanX < 0.18 || spanY < 0.18) return true;
  const area = shoelaceArea(uniq);
  const boxArea = Math.max(spanX * spanY, 1e-6);
  if (area / boxArea < 0.12) return true;
  if (uniq.some((_, i) => isSlashSegment(uniq[i]!, uniq[(i + 1) % uniq.length]!, box))) {
    return true;
  }
  if (uniq.length <= 5 && !isRectilinearOutline(uniq) && area / boxArea < 0.28) return true;
  return false;
}

/**
 * Vision polylines that are safe to draw on an elevation: no CAD slashes,
 * no 4-point garbage, camera-space crops mapped into the overall 0–1 frame.
 */
export function honestOutline(raw: PolyPt[] | undefined): PolyPt[] | undefined {
  if (!raw?.length) return undefined;
  const pts = uniquifyPts(
    raw
      .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })),
  );
  if (pts.length < 3) return undefined;
  const cleaned = uniquifyPts(dropSlashSegments(pts));
  if (isJunkOutline(cleaned)) return undefined;
  return alignOutlineToOverall(cleaned);
}

function pointInPoly(pt: PolyPt, poly: PolyPt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const hit =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + 1e-12) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

/** True when a layout blank mostly sits outside the elevation silhouette. */
export function rectOutsideOutline(
  rect: { x: number; y: number; w: number; h: number },
  outline: PolyPt[],
  worldW: number,
  worldH: number,
  invertY: boolean,
): boolean {
  if (!outline.length || worldW <= 0 || worldH <= 0) return false;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
  const toPoly = (c: { x: number; y: number }): PolyPt => ({
    x: c.x / worldW,
    y: invertY ? 1 - c.y / worldH : c.y / worldH,
  });
  let outside = 0;
  for (const c of corners) {
    if (!pointInPoly(toPoly(c), outline)) outside++;
  }
  const center = toPoly({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });
  if (!pointInPoly(center, outline) && outside >= 2) return true;
  return outside >= 3;
}

/** Axis-aligned 4–6-corner box. A saddle / splay / hoop polyline is not this. */
export function isRectilinearOutline(pts: PolyPt[] | undefined): boolean {
  if (!pts || pts.length < 4) return false;
  const uniq: PolyPt[] = [];
  for (const p of pts) {
    const last = uniq[uniq.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.012) uniq.push(p);
  }
  if (
    uniq.length >= 2 &&
    Math.hypot(uniq[0]!.x - uniq[uniq.length - 1]!.x, uniq[0]!.y - uniq[uniq.length - 1]!.y) <
      0.012
  ) {
    uniq.pop();
  }
  if (uniq.length < 4 || uniq.length > 6) return false;
  const xs = uniq.map((p) => p.x);
  const ys = uniq.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxX - minX < 0.12 || maxY - minY < 0.12) return false;
  const on = (v: number, a: number, b: number) => Math.abs(v - a) < 0.045 || Math.abs(v - b) < 0.045;
  return uniq.every((p) => on(p.x, minX, maxX) && on(p.y, minY, maxY));
}

export type RecoveredForm = {
  seatProfile?: SeatProfile;
  seatShape?: SeatShape;
  seatFront?: SeatFront;
  legStyle?: LegStyle;
  backProfile?: BackProfile;
};

/** Lift seat/leg/back language out of interpretation, notes, and visible details. */
export function recoverFormLanguage(blob: string): RecoveredForm {
  const t = blob.toLowerCase();
  const out: RecoveredForm = {};

  if (/\btractor\b/.test(t)) out.seatProfile = "tractor";
  else if (/\b(saddle|saddled)\b/.test(t)) out.seatProfile = "saddled";
  else if (/\b(sculpted|contoured|carved)\b/.test(t) && /\bseat\b/.test(t)) {
    out.seatProfile = "sculpted";
  } else if (/\bdished\b/.test(t) || (/\bdish\b/.test(t) && /\bseat\b/.test(t))) {
    out.seatProfile = "dished";
  } else if (/\bscooped\b/.test(t)) out.seatProfile = "scooped";
  else if (/\bwaterfall\b/.test(t) && /\bseat\b/.test(t) && !/\bfront\b/.test(t)) {
    out.seatProfile = "waterfall";
  }

  if (/\bhorseshoe\b/.test(t)) out.seatShape = "horseshoe";
  else if (/\bshield\b/.test(t) && /\bseat\b/.test(t)) out.seatShape = "shield";
  else if (/\bd[- ]shaped\b|\b d seat\b/.test(t)) out.seatShape = "D";
  else if (/\btrapezoid/.test(t)) out.seatShape = "trapezoid";
  else if (/\brounded[- ]rect|\bround[- ]over plan\b/.test(t)) out.seatShape = "rounded-rect";
  else if (/\b(round|circular|oval)\b/.test(t) && /\bseat\b/.test(t)) out.seatShape = "round";

  if (/\bwaterfall\b/.test(t)) out.seatFront = "waterfall";
  else if (/\bbullnose\b/.test(t)) out.seatFront = "bullnose";
  else if (/\brolled\b/.test(t) && /\bfront\b/.test(t)) out.seatFront = "rolled";
  else if (/\brounded front\b/.test(t)) out.seatFront = "rounded";

  if (/\bcabriole\b/.test(t)) out.legStyle = "cabriole";
  else if (/\b(saber|sabre)\b/.test(t)) out.legStyle = "saber";
  else if (/\bturned\b/.test(t) && /\bleg/.test(t)) out.legStyle = "turned";
  else if (/\b(taper\w* +splay|splay\w* +taper)/.test(t)) out.legStyle = "tapered-splay";
  else if (/\bsplay/.test(t)) out.legStyle = "splayed";
  else if (/\btaper/.test(t) && /\bleg/.test(t)) out.legStyle = "tapered";

  if (/\bwindsor\b/.test(t)) out.backProfile = "windsor";
  else if (/\bhoop\b/.test(t)) out.backProfile = "hoop";
  else if (/\breclin/.test(t)) out.backProfile = "reclined";
  else if (/\bladder\b/.test(t)) out.backProfile = "ladder";
  else if (/\bcurved back\b|\bbowed back\b/.test(t)) out.backProfile = "curved";

  return out;
}

export function hasShapedForm(spec: DrawingSpec): boolean {
  const side = honestOutline(spec.sideOutline);
  const front = honestOutline(spec.frontOutline);
  const plan = honestOutline(spec.planOutline);
  if (side && !isRectilinearOutline(side)) return true;
  if (front && !isRectilinearOutline(front)) return true;
  if (plan && !isRectilinearOutline(plan)) return true;
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

export function applyRecoveredForm(spec: DrawingSpec, recovered: RecoveredForm): DrawingSpec {
  const out: DrawingSpec = { ...spec };
  if (recovered.seatProfile && recovered.seatProfile !== "flat") {
    if (!out.seatProfile || out.seatProfile === "flat") out.seatProfile = recovered.seatProfile;
  }
  if (recovered.seatShape && recovered.seatShape !== "square") {
    if (!out.seatShape || out.seatShape === "square") out.seatShape = recovered.seatShape;
  }
  if (recovered.seatFront && recovered.seatFront !== "square") {
    if (!out.seatFront || out.seatFront === "square") out.seatFront = recovered.seatFront;
  }
  if (recovered.legStyle && recovered.legStyle !== "straight") {
    if (!out.legStyle || out.legStyle === "straight") out.legStyle = recovered.legStyle;
  }
  if (recovered.backProfile && recovered.backProfile !== "upright") {
    if (!out.backProfile || out.backProfile === "upright") out.backProfile = recovered.backProfile;
  }
  return out;
}

function preferShapedOutline(
  vision: PolyPt[] | undefined,
  generated: PolyPt[] | undefined,
  mode: "front" | "side" | "plan",
  spec: DrawingSpec,
): PolyPt[] | undefined {
  const constructed = generated;
  if (spec.preferConstructedOutline) return constructed;
  const clean = honestOutline(vision);
  if (clean && !isRectilinearOutline(clean)) return clean;
  const shapedSeat = spec.seatProfile && spec.seatProfile !== "flat";
  const nonSquarePlan = spec.seatShape && spec.seatShape !== "square";
  if (mode === "plan") {
    if (nonSquarePlan && constructed) return constructed;
    return clean;
  }
  if ((shapedSeat || hasShapedForm(spec) || spec.family === "chair") && constructed) {
    return constructed;
  }
  return clean;
}

export function outlineFor(
  mode: "front" | "side" | "plan",
  spec: DrawingSpec,
): PolyPt[] | undefined {
  if (mode === "side") {
    return preferShapedOutline(spec.sideOutline, generateSide(spec), "side", spec);
  }
  if (mode === "front") {
    return preferShapedOutline(spec.frontOutline, generateFront(spec), "front", spec);
  }
  return preferShapedOutline(spec.planOutline, generatePlan(spec), "plan", spec);
}

/** Persist elevation curves onto the spec so hydrate tests and captions see them. */
export function ensureElevationOutlines(spec: DrawingSpec): DrawingSpec {
  if (!hasShapedForm(spec)) return spec;
  return {
    ...spec,
    sideOutline: outlineFor("side", spec),
    frontOutline: outlineFor("front", spec),
    planOutline: outlineFor("plan", spec),
  };
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
  if (spec.seatFront === "waterfall" || spec.seatFront === "rolled") {
    return [
      { x: 0.06, y: 0.08 },
      { x: 0.18, y: 0.02 },
      { x: 0.82, y: 0.02 },
      { x: 0.94, y: 0.08 },
      { x: 0.98, y: 0.22 },
      { x: 0.96, y: 0.92 },
      { x: 0.08, y: 0.92 },
      { x: 0.04, y: 0.22 },
    ];
  }
  return undefined;
}

function generateSide(spec: DrawingSpec): PolyPt[] | undefined {
  if (!hasShapedForm(spec) && spec.family !== "chair") return undefined;
  if (spec.backStyle === "none") return generateBacklessSide(spec);
  const sh = spec.seatHeightRatio ?? (spec.family === "chair" ? 0.48 : 0.75);
  const namedDish =
    spec.seatDishIn && spec.seatDishIn > 0 ? Math.min(0.09, spec.seatDishIn / 12) : 0;
  const dish =
    namedDish ||
    (spec.seatProfile === "tractor"
      ? 0.06
      : spec.seatProfile === "saddled" || spec.seatProfile === "sculpted"
        ? 0.045
        : spec.seatProfile === "dished" || spec.seatProfile === "scooped"
          ? 0.03
          : 0);
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
  const lowBack = spec.backStyle === "solid" && !recline && !curvedBack;
  const backTop = recline ? 0.92 : curvedBack ? 0.9 : lowBack ? 0.72 : 0.82;
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
    { x: recline ? 0.96 : curvedBack ? 0.86 : backX + 0.02, y: backTop },
    { x: recline ? 1 : 0.94, y: backTop },
    { x: backX + 0.08, y: 0.7 },
    { x: 0.78, y: 0.08 },
    { x: 0.7 + splay, y: 0 },
  ];
}

function generateBacklessSide(spec: DrawingSpec): PolyPt[] {
  const sh = spec.seatHeightRatio ?? 0.48;
  const dish =
    spec.seatProfile && spec.seatProfile !== "flat"
      ? spec.seatProfile === "tractor"
        ? 0.05
        : 0.03
      : 0;
  const splay =
    spec.legStyle === "splayed" || spec.legStyle === "tapered-splay" ? 0.06 : 0.03;
  return [
    { x: 0.12 + splay, y: 0 },
    { x: 0.14, y: sh - 0.02 },
    { x: 0.08, y: sh },
    { x: 0.45, y: sh - dish },
    { x: 0.9, y: sh },
    { x: 0.86, y: sh - 0.02 },
    { x: 0.82 + splay, y: 0 },
  ];
}

function generateBacklessFront(spec: DrawingSpec): PolyPt[] {
  const sh = spec.seatHeightRatio ?? 0.48;
  const splay =
    spec.legStyle === "splayed" || spec.legStyle === "tapered-splay" ? 0.08 : 0.04;
  const dish =
    spec.seatProfile && spec.seatProfile !== "flat"
      ? spec.seatProfile === "tractor"
        ? 0.05
        : 0.03
      : 0;
  return [
    { x: 0.14 - splay, y: 0 },
    { x: 0.18, y: sh - 0.02 },
    { x: 0.08, y: sh },
    { x: 0.5, y: sh - dish },
    { x: 0.92, y: sh },
    { x: 0.82, y: sh - 0.02 },
    { x: 0.86 + splay, y: 0 },
    { x: 0.78, y: 0 },
    { x: 0.72, y: sh - 0.05 },
    { x: 0.28, y: sh - 0.05 },
    { x: 0.22, y: 0 },
  ];
}

function generateFront(spec: DrawingSpec): PolyPt[] | undefined {
  if (spec.family !== "chair" && !hasShapedForm(spec)) return undefined;
  if (spec.backStyle === "none") return generateBacklessFront(spec);
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
  const topY = spec.backStyle === "solid" ? 0.74 : 0.98;
  const seatY = sh;
  const footIn = taper ? splay + 0.02 : splay;
  const dish =
    spec.seatProfile && spec.seatProfile !== "flat"
      ? spec.seatProfile === "tractor"
        ? 0.05
        : 0.03
      : 0;
  return [
    { x: 0.12 - splay, y: 0 },
    { x: 0.16, y: seatY - 0.02 },
    { x: 0.04, y: seatY },
    { x: 0.5, y: seatY - dish },
    { x: 0.96, y: seatY },
    { x: 0.84, y: seatY - 0.02 },
    { x: 0.88 + splay, y: 0 },
    { x: 0.88 + splay - 0.06, y: 0 },
    { x: 0.78, y: seatY - 0.04 },
    { x: 0.78, y: 0.7 },
    { x: 0.5 + crest / 2, y: topY },
    { x: 0.5, y: spec.backProfile === "hoop" ? Math.min(1, topY + 0.04) : topY - 0.02 },
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
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xy(p)}`).join(" ");
  return close ? `${d} Z` : d;
}
