import { hasBackEvidence } from "../drawing";
import { inferRole, isPartRole } from "../layout";
import { round32 } from "../format";
import {
  hasPhotoIndex,
  isKnownDim,
  isTapeMeasured,
} from "../measure";
import type {
  DrawingSpec,
  MeasuredDim,
  Overall,
  PartMeasured,
  PartRole,
  Project,
  ScaleConfidence,
} from "../types";

export const INFER_RULES = [
  "overall",
  "seat-height",
  "symmetric",
  "stretcher-span",
  "footring-height",
] as const;

export type InferRule = (typeof INFER_RULES)[number];

export type InferInstance = {
  x: number;
  y: number;
  z: number;
  lengthAlong?: string;
  widthAlong?: string;
};

export type InferCandidate = {
  name: string;
  role?: string;
  qty: number;
  measured: PartMeasured;
  instances?: InferInstance[];
};

export type InferContext = {
  overall?: Overall | null;
  overallSource?: Project["overallSource"];
  scaleConfidence?: ScaleConfidence;
  name?: string;
  category?: string;
  interpretation?: string;
  drawing?: Partial<DrawingSpec>;
};

const INFER_CONFIDENCE = 0.45;

const SEAT_BAND = {
  dining: 17.5,
  counter: 25,
  bar: 30,
} as const;

type SeatBand = keyof typeof SEAT_BAND;

/** Builder-facing trust string. Formatters reuse this verbatim. */
export function inferTrustNote(rule?: InferRule): string {
  switch (rule) {
    case "seat-height":
    case "footring-height":
      return "guessed from seat height — verify";
    case "overall":
      return "guessed from overall — verify";
    case "symmetric":
      return "guessed from the matching pair — verify";
    case "stretcher-span":
      return "guessed from the clear span — verify";
    default:
      return "guessed — verify";
  }
}

export function inferredDim(value: number, rule?: InferRule): MeasuredDim {
  return {
    value: round32(value),
    source: "inferred",
    confidence: INFER_CONFIDENCE,
    note: inferTrustNote(rule),
  };
}

export function isUnknownAxis(dim: MeasuredDim | undefined): boolean {
  return !dim || dim.source === "unknown" || dim.value == null;
}

export function partHasUnknownCutAxis(measured: PartMeasured): boolean {
  return (["length", "width", "thickness"] as const).some((axis) =>
    isUnknownAxis(measured[axis]),
  );
}

function overallIsAnchor(ctx: InferContext): boolean {
  if (!ctx.overall) return false;
  if (ctx.scaleConfidence === "conflict") return false;
  if (ctx.overallSource === "labeled") return true;
  return ctx.scaleConfidence === "high";
}

function isAnchorDim(dim: MeasuredDim | undefined): boolean {
  if (!isKnownDim(dim)) return false;
  if (dim.source !== "measured") return false;
  return dim.confidence >= 0.7 || hasPhotoIndex(dim);
}

function cloneCandidate(part: InferCandidate): InferCandidate {
  return {
    ...part,
    measured: {
      length: { ...part.measured.length },
      width: { ...part.measured.width },
      thickness: { ...part.measured.thickness },
    },
    instances: part.instances?.map((inst) => ({ ...inst })),
  };
}

function roleOf(part: InferCandidate): PartRole {
  return isPartRole(part.role) ? part.role : inferRole("", part.name);
}

function pairKey(part: InferCandidate): string | null {
  const role = roleOf(part);
  const name = part.name.toLowerCase();
  const front = /\bfront\b/.test(name);
  const back = /\bback\b/.test(name);

  if (role === "leg" || role === "stile" || role === "post") {
    if (front) return "leg:front";
    if (back) return "leg:back";
    return `leg:${role}`;
  }
  if (
    role === "stretcher" ||
    role === "apron" ||
    role === "apron-long" ||
    role === "apron-short"
  ) {
    if (front || back) return "rail:front-back";
    if (/\bside\b/.test(name)) return "rail:side";
    return `rail:${role}`;
  }
  if (role === "rail" || role === "arm" || role === "side") return role;
  return null;
}

function anchorScore(part: InferCandidate): number {
  return (["length", "width", "thickness"] as const).filter((axis) =>
    isAnchorDim(part.measured[axis]),
  ).length;
}

function applySymmetric(parts: InferCandidate[]): void {
  const groups = new Map<string, InferCandidate[]>();
  for (const part of parts) {
    const key = pairKey(part);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(part);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const donor = group.reduce((best, part) =>
      anchorScore(part) > anchorScore(best) ? part : best,
    );
    if (anchorScore(donor) === 0) continue;

    for (const part of group) {
      if (part === donor) continue;
      for (const axis of ["length", "width", "thickness"] as const) {
        if (!isUnknownAxis(part.measured[axis])) continue;
        const src = donor.measured[axis];
        if (!isKnownDim(src)) continue;
        if (axis === "thickness") {
          if (!isTapeMeasured(src)) continue;
        } else if (!isAnchorDim(src)) {
          continue;
        }
        part.measured[axis] = inferredDim(src.value, "symmetric");
      }
    }
  }
}

function applyOverallToBoxParts(parts: InferCandidate[], ctx: InferContext): void {
  if (!overallIsAnchor(ctx) || !ctx.overall) return;
  const section = knownLegSection(parts);
  for (const part of parts) {
    const role = roleOf(part);
    if (role !== "seat" && role !== "top") continue;
    // Seat sits in the box: overall minus the leg section we actually saw.
    // Tops stay the box. No subtract when section is only a stock guess.
    const sub = role === "seat" && section != null && section > 0 ? 2 * section : 0;
    if (isUnknownAxis(part.measured.length)) {
      const value = ctx.overall.w - sub;
      if (value > 0.25) part.measured.length = inferredDim(value, "overall");
    }
    if (isUnknownAxis(part.measured.width)) {
      const value = ctx.overall.d - sub;
      if (value > 0.25) part.measured.width = inferredDim(value, "overall");
    }
  }
}

function knownLegSection(parts: InferCandidate[]): number | null {
  for (const part of parts) {
    const role = roleOf(part);
    if (role !== "leg" && role !== "post") continue;
    if (isAnchorDim(part.measured.width)) return part.measured.width.value;
    if (isTapeMeasured(part.measured.thickness) || isAnchorDim(part.measured.thickness)) {
      return part.measured.thickness.value;
    }
  }
  return null;
}

function stretcherSpanAxis(
  part: InferCandidate,
  overall: Overall,
): "w" | "d" | null {
  const name = part.name.toLowerCase();
  const role = roleOf(part);
  if (/\bside\b/.test(name) || role === "apron-short") return "d";
  if (/\bfront\b|\bback\b/.test(name) || role === "apron-long") return "w";
  const along = part.instances?.[0]?.lengthAlong;
  if (along === "y") return "d";
  if (along === "x") return "w";
  if (Math.abs(overall.w - overall.d) < 0.5) return "w";
  return null;
}

function applyStretcherSpan(parts: InferCandidate[], ctx: InferContext): void {
  if (!overallIsAnchor(ctx) || !ctx.overall) return;
  const section = knownLegSection(parts);
  if (section == null || section <= 0) return;

  for (const part of parts) {
    const role = roleOf(part);
    if (
      role !== "stretcher" &&
      role !== "apron" &&
      role !== "apron-long" &&
      role !== "apron-short"
    ) {
      continue;
    }
    if (!isUnknownAxis(part.measured.length)) continue;
    const axis = stretcherSpanAxis(part, ctx.overall);
    if (!axis) continue;
    const span = ctx.overall[axis] - 2 * section;
    if (span <= 0.25) continue;
    part.measured.length = inferredDim(span, "stretcher-span");
  }
}

function isBackLeg(part: InferCandidate): boolean {
  const name = part.name.toLowerCase();
  const role = roleOf(part);
  return role === "stile" || ((role === "leg" || role === "post") && /\bback\b/.test(name));
}

function isFrontLeg(part: InferCandidate): boolean {
  const role = roleOf(part);
  if (role !== "leg" && role !== "post") return false;
  if (isBackLeg(part)) return false;
  return /\bfront\b/.test(part.name.toLowerCase());
}

function isStoolLegSet(part: InferCandidate, parts: InferCandidate[]): boolean {
  if (roleOf(part) !== "leg" && roleOf(part) !== "post") return false;
  if (/\bfront\b|\bback\b/.test(part.name.toLowerCase())) return false;
  return !parts.some(isBackLeg) && part.qty >= 3;
}

function readingHasBack(parts: InferCandidate[], ctx: InferContext): boolean {
  if (
    hasBackEvidence({
      name: ctx.name ?? "",
      interpretation: ctx.interpretation ?? "",
      parts: parts.map((part) => ({
        name: part.name,
        role: isPartRole(part.role) ? part.role : undefined,
      })),
      drawing: ctx.drawing,
    })
  ) {
    return true;
  }
  const blob = `${ctx.name ?? ""} ${ctx.category ?? ""} ${ctx.interpretation ?? ""}`.toLowerCase();
  if (/\bstool\b/.test(blob)) return false;
  if (ctx.drawing?.backStyle === "none") return false;
  return /\bchair\b/.test(blob) && (ctx.overall?.h ?? 0) >= 30;
}

function classifySeatBand(
  ctx: InferContext,
  overallH: number,
  backed: boolean,
): SeatBand {
  const blob = `${ctx.name ?? ""} ${ctx.category ?? ""} ${ctx.interpretation ?? ""}`.toLowerCase();
  if (/\bbar\b/.test(blob)) return "bar";
  if (/\bcounter\b/.test(blob)) return "counter";
  if (/\bdining|kitchen|side chair\b/.test(blob)) return "dining";
  if (!backed) {
    if (overallH <= 20) return "dining";
    if (overallH <= 27) return "counter";
    return "bar";
  }
  if (overallH < 38) return "dining";
  if (overallH < 44) return "counter";
  return "bar";
}

function knownSeatHeight(parts: InferCandidate[]): number | null {
  const seat = parts.find((part) => roleOf(part) === "seat");
  const z = seat?.instances?.find((inst) => Number.isFinite(inst.z) && inst.z > 4)?.z;
  if (z != null) {
    const t = isKnownDim(seat?.measured.thickness) ? seat.measured.thickness.value : 0;
    return z + t;
  }
  for (const part of parts) {
    if (!isFrontLeg(part) && !isStoolLegSet(part, parts)) continue;
    if (isKnownDim(part.measured.length) && part.measured.length.value > 10) {
      return part.measured.length.value;
    }
  }
  return null;
}

function applySeatHeight(parts: InferCandidate[], ctx: InferContext): void {
  if (!overallIsAnchor(ctx) || !ctx.overall) return;

  let height = knownSeatHeight(parts);
  if (height == null) {
    const backed = readingHasBack(parts, ctx);
    if (!backed) {
      const seat = parts.find((part) => roleOf(part) === "seat");
      const t =
        seat && isKnownDim(seat.measured.thickness) ? seat.measured.thickness.value : 0;
      height = ctx.overall.h - t;
    } else {
      height = SEAT_BAND[classifySeatBand(ctx, ctx.overall.h, backed)];
    }
  }
  if (height == null || height <= 0) return;

  for (const part of parts) {
    if (isBackLeg(part)) {
      if (isUnknownAxis(part.measured.length)) {
        part.measured.length = inferredDim(ctx.overall.h, "overall");
      }
      continue;
    }
    const fill =
      isFrontLeg(part) || isStoolLegSet(part, parts);
    if (!fill || !isUnknownAxis(part.measured.length)) continue;
    part.measured.length = inferredDim(height, "seat-height");
  }

  const seat = parts.find((part) => roleOf(part) === "seat");
  if (!seat) return;
  const t = isKnownDim(seat.measured.thickness) ? seat.measured.thickness.value : 0;
  const z = Math.max(0, height - t);
  if (seat.instances?.length) {
    for (const inst of seat.instances) {
      if (!inst.z || inst.z <= 0) inst.z = z;
    }
  }
}

function applyFootringHeight(parts: InferCandidate[]): void {
  const height = knownSeatHeight(parts);
  if (height == null || height <= 0) return;
  const z = round32(height * 0.4);
  for (const part of parts) {
    const name = part.name.toLowerCase();
    if (!/\bfootring|foot rail\b/.test(name)) continue;
    if (!part.instances?.length) continue;
    for (const inst of part.instances) {
      if (!inst.z || inst.z <= 0) inst.z = z;
    }
  }
}

export type InferFillResult = {
  parts: InferCandidate[];
  /** Cut-axis fills this pass wrote. Placement-only (instance.z) is not counted. */
  filledAxes: number;
};

function countUnknownAxes(parts: InferCandidate[]): number {
  let n = 0;
  for (const part of parts) {
    for (const axis of ["length", "width", "thickness"] as const) {
      if (isUnknownAxis(part.measured[axis])) n += 1;
    }
  }
  return n;
}

/**
 * Fill SAFE unknown axes after vision hydrate. Never promotes to measured.
 * Never invents stock thickness. Does not touch outdoor species/stock.
 */
export function inferFill(
  parts: InferCandidate[],
  ctx: InferContext,
): InferCandidate[] {
  return runInferFill(parts, ctx).parts;
}

export function runInferFill(
  parts: InferCandidate[],
  ctx: InferContext,
): InferFillResult {
  const next = parts.map(cloneCandidate);
  const beforeUnknown = countUnknownAxes(next);
  applySymmetric(next);
  applyOverallToBoxParts(next, ctx);
  applySeatHeight(next, ctx);
  applyStretcherSpan(next, ctx);
  applyFootringHeight(next);
  return {
    parts: next,
    filledAxes: Math.max(0, beforeUnknown - countUnknownAxes(next)),
  };
}
