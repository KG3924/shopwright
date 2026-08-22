import { formatInches } from "./format";
import type { PartRole, Rank } from "./types";

export type ElevationAxis = "W" | "D" | "H";
export type ElevationMode = "front" | "side" | "plan";

export type ElevationCallout = {
  axis: ElevationAxis;
  text: string;
  inches: string;
  unknown: boolean;
};

export type ElevationRect = {
  letter: string;
  role: PartRole;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  unknownW?: boolean;
  unknownH?: boolean;
};

export type ElevationLabel = ElevationRect & {
  beside: boolean;
};

export type BadgePoint = {
  id: string;
  letter: string;
  x: number;
  y: number;
};

const MAJOR_ROLES = new Set<PartRole>([
  "top",
  "seat",
  "leg",
  "rail",
  "stretcher",
  "apron",
  "apron-long",
  "apron-short",
  "post",
  "stile",
]);

const QUIET_RANKS = new Set<Rank>(["beginner", "novice"]);

/** Shop overall callout. Null / non-finite / zero inches print `?` — never a fake 0". */
export function elevationCallout(
  axis: ElevationAxis,
  inches: number | null | undefined,
): ElevationCallout {
  const unknown = inches == null || !Number.isFinite(inches) || inches <= 0;
  const sized = unknown ? "?" : formatInches(inches);
  return {
    axis,
    text: `${axis} ${sized}`,
    inches: sized,
    unknown,
  };
}

export function formatElevationCallout(
  axis: ElevationAxis,
  inches: number | null | undefined,
): string {
  return elevationCallout(axis, inches).text;
}

export function elevationViewAxes(
  mode: ElevationMode,
): { xName: ElevationAxis; yName: ElevationAxis } {
  if (mode === "side") return { xName: "D", yName: "H" };
  if (mode === "plan") return { xName: "W", yName: "D" };
  return { xName: "W", yName: "H" };
}

export function isMajorShopPart(role: PartRole): boolean {
  return MAJOR_ROLES.has(role);
}

export function isQuietRank(rank: Rank | undefined): boolean {
  return !!rank && QUIET_RANKS.has(rank);
}

/** Front/side/plan letters a novice can read — major parts only, no slat stampede. */
export function labelElevationParts(rects: ElevationRect[]): ElevationLabel[] {
  const majors = rects.filter((r) => isMajorShopPart(r.role));
  const kept: ElevationRect[] = [];
  const seen = new Set<string>();
  for (const r of majors) {
    const key = [
      r.letter,
      Math.round(r.x),
      Math.round(r.y),
      Math.round(r.w),
      Math.round(r.h),
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(r);
  }
  return kept.map((r) => ({
    ...r,
    beside: Math.min(r.w, r.h) < 4,
  }));
}

/** Extra air on a beginner explode; craftsman stays closer to the assembled piece. */
export function explodeOffset(
  overall: { w: number; d: number; h: number },
  rank?: Rank,
): number {
  const max = Math.max(overall.w, overall.d, overall.h);
  const factor = isQuietRank(rank) ? 0.3 : 0.22;
  return max * factor;
}

export function assemblyStepsOpen(rank?: Rank): boolean {
  return !isQuietRank(rank);
}

export function isoShowsBadge(role: PartRole, rank?: Rank): boolean {
  if (isQuietRank(rank)) return isMajorShopPart(role);
  return true;
}

/** Nudge overlapping letter badges apart so they stay readable. */
export function separateBadges(
  points: BadgePoint[],
  minDist: number,
  iterations = 10,
): BadgePoint[] {
  const out = points.map((p) => ({ ...p }));
  if (out.length < 2 || minDist <= 0) return out;
  for (let k = 0; k < iterations; k++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        const nx = d < 1e-6 ? 1 : dx / d;
        const ny = d < 1e-6 ? 0 : dy / d;
        const push = (minDist - (d < 1e-6 ? 0 : d)) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
  return out;
}
