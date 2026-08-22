import { formatInches } from "./format";
import type {
  CutRow,
  DimSource,
  MeasuredDim,
  PartMeasured,
  ScaleConfidence,
} from "./types";
import { DIM_SOURCES, SCALE_CONFIDENCES } from "./types";

export const VISION_SOURCE_KINDS = ["photo", "url", "blueprint"] as const;
export type VisionSourceKind = (typeof VISION_SOURCE_KINDS)[number];

export function isVisionSourceKind(kind: string): kind is VisionSourceKind {
  return (VISION_SOURCE_KINDS as readonly string[]).includes(kind);
}

export function isDimSource(value: unknown): value is DimSource {
  return typeof value === "string" && (DIM_SOURCES as readonly string[]).includes(value);
}

export function isScaleConfidence(value: unknown): value is ScaleConfidence {
  return (
    typeof value === "string" &&
    (SCALE_CONFIDENCES as readonly string[]).includes(value)
  );
}

export function unknownDim(note?: string): MeasuredDim {
  return { value: null, source: "unknown", confidence: 0, note };
}

export function isKnownDim(
  dim: MeasuredDim | undefined,
): dim is MeasuredDim & { value: number } {
  return !!dim && dim.source !== "unknown" && dim.value != null && Number.isFinite(dim.value);
}

export function sourcedAxisCount(measured: PartMeasured): number {
  return (["length", "width", "thickness"] as const).filter((axis) =>
    isKnownDim(measured[axis]),
  ).length;
}

/** A vision part is usable when at least two axes were sourced — not invented. */
export function hasSourcedDims(measured: PartMeasured): boolean {
  return sourcedAxisCount(measured) >= 2;
}

export function weakScale(confidence: ScaleConfidence | undefined): boolean {
  return confidence === "low" || confidence === "conflict";
}

export function formatMeasured(
  dim: MeasuredDim | undefined,
  resolved?: number,
): string {
  if (dim && dim.value == null) return "?";
  if (dim?.value != null && Number.isFinite(dim.value)) {
    return formatInches(dim.value);
  }
  if (resolved != null && Number.isFinite(resolved)) return formatInches(resolved);
  return "?";
}

export function formatCutAxis(
  cut: Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">,
  axis: "length" | "width" | "thickness",
): string {
  if (cut.locked?.[axis]) return formatInches(cut[axis]);
  const measured = cut.measured?.[axis];
  if (measured && measured.value == null) return "?";
  return formatInches(cut[axis]);
}

export function formatCutTriplet(
  cut: Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">,
): string {
  return `${formatCutAxis(cut, "length")} × ${formatCutAxis(cut, "width")} × ${formatCutAxis(cut, "thickness")}`;
}

export type CutAxis = "length" | "width" | "thickness";

export function isCutAxisUnknown(
  cut: Pick<CutRow, "measured" | "locked">,
  axis: CutAxis,
): boolean {
  if (cut.locked?.[axis]) return false;
  const measured = cut.measured?.[axis];
  return !!measured && measured.value == null;
}

/** Count of ticket axes that still print `?` (not tickets, axes). */
export function ticketUnknownAxes(
  cuts: Array<Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">>,
): number {
  let n = 0;
  for (const cut of cuts) {
    for (const axis of ["length", "width", "thickness"] as const) {
      if (formatCutAxis(cut, axis) === "?") n += 1;
    }
  }
  return n;
}

export type TicketView = "face" | "edge" | "end";

/** Face / edge / end labels bound to MeasuredDim — unknown axes stay `?`. */
export function ticketViewLabels(
  cut: Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">,
  view: TicketView,
): { x: string; y: string; unknownX: boolean; unknownY: boolean } {
  const axis =
    view === "face"
      ? (["length", "width"] as const)
      : view === "edge"
        ? (["length", "thickness"] as const)
        : (["width", "thickness"] as const);
  return {
    x: formatCutAxis(cut, axis[0]),
    y: formatCutAxis(cut, axis[1]),
    unknownX: isCutAxisUnknown(cut, axis[0]),
    unknownY: isCutAxisUnknown(cut, axis[1]),
  };
}

export function clampInch(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
