import { z } from "zod";
import { getTemplate, matchTemplate } from "../catalog";
import { instantiate } from "../compile";
import { inferDrawing, isAdirondackReading, isUprightChair } from "../drawing";
import { inferRole, isPartRole } from "../layout";
import {
  clampInch,
  hasSourcedDims,
  isDimSource,
  isTapeMeasured,
  sourcedAxisCount,
  unknownDim,
  weakScale,
} from "../measure";
import { inferDim } from "../parametric";
import { normalizeTools } from "../routes";
import type {
  Axis3,
  DrawingSpec,
  MeasuredDim,
  Overall,
  Part,
  PartInstance,
  PartMeasured,
  Project,
  Rank,
  ScaleConfidence,
  ShopTool,
} from "../types";

export const INTERPRET_ERROR_CODES = [
  "invalid_json",
  "incomplete_parts",
  "missing_overall",
  "unsafe_packet",
] as const;

export type InterpretErrorCode = (typeof INTERPRET_ERROR_CODES)[number];

export class InterpretError extends Error {
  readonly code: InterpretErrorCode;
  constructor(code: InterpretErrorCode, message: string) {
    super(message);
    this.name = "InterpretError";
    this.code = code;
  }
}

export type InterpretInput = {
  imageDataUrl?: string;
  imageDataUrls?: string[];
  url?: string;
  note?: string;
  kind: "photo" | "url" | "blueprint";
  rank: Rank;
  toolsAvailable?: ShopTool[];
};

const MeasuredDimInputSchema = z.union([
  z.number().finite(),
  z.null(),
  z.object({
    value: z.number().finite().nullable().optional(),
    source: z.enum(["measured", "inferred", "unknown"]).optional(),
    confidence: z.number().optional(),
    photoIndex: z.number().int().optional(),
    note: z.string().optional(),
  }),
]);

const AiInstanceSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  lengthAlong: z.string().optional(),
  widthAlong: z.string().optional(),
});

const AiPartSchema = z.object({
  name: z.string(),
  qty: z.union([z.number().finite(), z.string()]).optional(),
  length: MeasuredDimInputSchema.optional(),
  width: MeasuredDimInputSchema.optional(),
  thickness: MeasuredDimInputSchema.optional(),
  lengthIn: z.number().finite().optional(),
  widthIn: z.number().finite().optional(),
  thicknessIn: z.number().finite().optional(),
  stock: z.string().optional(),
  role: z.string().optional(),
  letter: z.string().optional(),
  notes: z.string().optional(),
  instances: z.array(AiInstanceSchema).optional(),
});

const OverallSchema = z.object({
  w: z.number().finite(),
  d: z.number().finite(),
  h: z.number().finite(),
});

const DrawingSchema = z
  .object({
    family: z.enum(["table", "case", "chair", "feeder"]).optional(),
    backStyle: z
      .enum(["lattice", "x-back", "splat", "slat-fan", "solid", "none"])
      .optional(),
    hasArms: z.boolean().optional(),
    hasFootring: z.boolean().optional(),
    seatShape: z.enum(["square", "round"]).optional(),
    seatHeightRatio: z.number().finite().optional(),
    reclined: z.boolean().optional(),
  })
  .optional();

export const AiJsonSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  templateId: z.string().nullable().optional(),
  interpretation: z.string().optional(),
  confidence: z.number().optional(),
  overall: OverallSchema.optional(),
  overallSource: z.enum(["labeled", "estimated", "assumed"]).optional(),
  scaleConfidence: z.enum(["high", "low", "conflict"]).optional(),
  scaleNotes: z.array(z.string()).optional(),
  speciesGuess: z.string().optional(),
  uncertainties: z.array(z.string()).optional(),
  suggestedRouteId: z.string().optional(),
  parts: z.array(AiPartSchema).optional(),
  drawing: DrawingSchema,
});

export type AiJson = z.infer<typeof AiJsonSchema>;
type AiPart = NonNullable<AiJson["parts"]>[number];

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asFinite(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function coerceMeasured(
  explicit: unknown,
  legacyIn: unknown,
): MeasuredDim {
  if (explicit && typeof explicit === "object") {
    const raw = explicit as {
      value?: unknown;
      source?: unknown;
      confidence?: unknown;
      photoIndex?: unknown;
      note?: unknown;
    };
    const value =
      raw.value === null || raw.value === undefined
        ? null
        : (asFinite(raw.value) ?? null);
    const source: MeasuredDim["source"] = isDimSource(raw.source)
      ? raw.source
      : value == null
        ? "unknown"
        : "inferred";
    const confidence = clampInch(asFinite(raw.confidence) ?? (source === "measured" ? 0.85 : source === "inferred" ? 0.45 : 0), 0, 1);
    return {
      value: source === "unknown" ? null : value,
      source,
      confidence,
      photoIndex: Number.isInteger(raw.photoIndex) ? (raw.photoIndex as number) : undefined,
      note: typeof raw.note === "string" ? raw.note : undefined,
    };
  }
  if (explicit === null) return unknownDim();
  const fromExplicitNumber = asFinite(explicit);
  if (fromExplicitNumber != null) {
    return { value: fromExplicitNumber, source: "inferred", confidence: 0.45 };
  }
  const fromLegacy = asFinite(legacyIn);
  if (fromLegacy != null) {
    return { value: fromLegacy, source: "inferred", confidence: 0.4 };
  }
  return unknownDim();
}

function pickTemplate(ai: AiJson) {
  const reading = { ...ai, templateId: ai.templateId ?? undefined };
  if (isUprightChair(reading)) return getTemplate("side-chair");
  if (isAdirondackReading(reading)) return getTemplate("adirondack");
  return matchTemplate(ai.templateId ?? ai.category ?? undefined, ai.name);
}

function asAxis3(value: string | undefined): Axis3 | undefined {
  if (value === "x" || value === "y" || value === "z") return value;
  return undefined;
}

function mapInstances(
  raw: AiPart["instances"],
  from: Overall,
  to: Overall,
): PartInstance[] | undefined {
  if (!raw?.length) return undefined;
  const sx = to.w / (from.w || to.w);
  const sy = to.d / (from.d || to.d);
  const sz = to.h / (from.h || to.h);
  const mapped = raw
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
    .map((p) => ({
      x: p.x * sx,
      y: p.y * sy,
      z: p.z * sz,
      lengthAlong: asAxis3(p.lengthAlong),
      widthAlong: asAxis3(p.widthAlong),
    }));
  return mapped.length ? mapped : undefined;
}

function measuredOf(part: AiPart): PartMeasured {
  return {
    length: coerceMeasured(part.length, part.lengthIn),
    width: coerceMeasured(part.width, part.widthIn),
    thickness: coerceMeasured(part.thickness, part.thicknessIn),
  };
}

function layoutInch(dim: MeasuredDim, fallback = 0): number {
  return dim.value != null && Number.isFinite(dim.value) ? dim.value : fallback;
}

function deriveOverall(ai: AiJson, parts: { measured: PartMeasured; instances?: AiPart["instances"] }[]): Overall | null {
  if (
    ai.overall &&
    Number.isFinite(ai.overall.w) &&
    Number.isFinite(ai.overall.d) &&
    Number.isFinite(ai.overall.h)
  ) {
    return {
      w: clampInch(ai.overall.w, 4, 160),
      d: clampInch(ai.overall.d, 3, 80),
      h: clampInch(ai.overall.h, 3, 120),
    };
  }

  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  let sawInstance = false;
  for (const part of parts) {
    const L = layoutInch(part.measured.length);
    const W = layoutInch(part.measured.width);
    const T = layoutInch(part.measured.thickness);
    for (const inst of part.instances ?? []) {
      if (!Number.isFinite(inst.x) || !Number.isFinite(inst.y) || !Number.isFinite(inst.z)) {
        continue;
      }
      sawInstance = true;
      const alongL = inst.lengthAlong;
      const alongW = inst.widthAlong;
      const ext = { x: L, y: W, z: T };
      if (alongL === "x" || alongL === "y" || alongL === "z") ext[alongL] = L;
      if (alongW === "x" || alongW === "y" || alongW === "z") ext[alongW] = W;
      maxX = Math.max(maxX, inst.x + ext.x);
      maxY = Math.max(maxY, inst.y + ext.y);
      maxZ = Math.max(maxZ, inst.z + ext.z);
    }
  }
  if (sawInstance && maxX >= 4 && maxY >= 3 && maxZ >= 3) {
    return {
      w: clampInch(maxX, 4, 160),
      d: clampInch(maxY, 3, 80),
      h: clampInch(maxZ, 3, 120),
    };
  }
  return null;
}

function extentsDisagree(overall: Overall, parts: { measured: PartMeasured; instances?: AiPart["instances"] }[]): boolean {
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  let saw = false;
  for (const part of parts) {
    for (const inst of part.instances ?? []) {
      if (!Number.isFinite(inst.x) || !Number.isFinite(inst.y) || !Number.isFinite(inst.z)) continue;
      saw = true;
      maxX = Math.max(maxX, inst.x + layoutInch(part.measured.length));
      maxY = Math.max(maxY, inst.y + layoutInch(part.measured.width));
      maxZ = Math.max(maxZ, inst.z + layoutInch(part.measured.thickness));
    }
  }
  if (!saw) return false;
  const ratio = (a: number, b: number) => (b <= 0 ? 0 : Math.abs(a - b) / b);
  return ratio(maxX, overall.w) > 0.18 || ratio(maxY, overall.d) > 0.18 || ratio(maxZ, overall.h) > 0.18;
}

function resolveScale(
  ai: AiJson,
  parts: { measured: PartMeasured; instances?: AiPart["instances"] }[],
  overall: Overall,
): { scaleConfidence: ScaleConfidence; scaleNotes: string[]; doNotCut: boolean } {
  const notes = [...(ai.scaleNotes ?? [])].filter((n) => n.trim());
  let scaleConfidence: ScaleConfidence = ai.scaleConfidence ?? "low";

  if (!ai.scaleConfidence) {
    const measuredAxes = parts.reduce(
      (n, p) =>
        n +
        (["length", "width", "thickness"] as const).filter((axis) =>
          isTapeMeasured(p.measured[axis]),
        ).length,
      0,
    );
    if (ai.overallSource === "labeled" && measuredAxes >= 2) scaleConfidence = "high";
    else if (ai.overallSource === "assumed") scaleConfidence = "low";
    else if (measuredAxes >= 3) scaleConfidence = "high";
    else scaleConfidence = "low";
  }

  if (ai.overall && extentsDisagree(overall, parts)) {
    scaleConfidence = "conflict";
    notes.push("Labeled overall size and the boards we placed do not agree.");
  }

  const thin = parts.filter((p) => sourcedAxisCount(p.measured) < 3).length;
  if (thin > 0) {
    notes.push(
      thin === 1
        ? "One board is missing a sourced axis — tickets will print ? until you measure it."
        : `${thin} boards are missing a sourced axis — tickets will print ? until you measure them.`,
    );
  }

  return {
    scaleConfidence,
    scaleNotes: [...new Set(notes)],
    doNotCut: weakScale(scaleConfidence),
  };
}

function toGraphParts(
  raw: { part: AiPart; measured: PartMeasured }[],
  overall: Overall,
  rawOverall: Overall,
): Part[] {
  return raw.map(({ part, measured }, i) => {
    const name = part.name.trim() || `Part ${i + 1}`;
    const stock = (
      ["solid", "plywood", "hardwood-ply", "dowel", "sheet"] as const
    ).includes(part.stock as Part["stock"])
      ? (part.stock as Part["stock"])
      : "solid";
    const lengthVal = layoutInch(measured.length);
    const widthVal = layoutInch(measured.width);
    const thicknessVal = layoutInch(measured.thickness, 0);
    return {
      id: `p${i}`,
      name,
      qty: Math.max(1, Math.round(Number(part.qty) || 1) || 1),
      length: inferDim(name, "length", lengthVal, overall),
      width: inferDim(name, "width", widthVal, overall),
      thickness: inferDim(name, "thickness", thicknessVal || 0, overall),
      stock,
      grain: "length" as const,
      notes: part.notes,
      role: isPartRole(part.role) ? part.role : inferRole(`p${i}`, name),
      instances: mapInstances(part.instances, rawOverall, overall),
      letter: part.letter?.slice(0, 3),
      measured,
    };
  });
}

/**
 * Zod-validate vision JSON. Invalid or empty payloads fail loud.
 * Partial objects that still have a parts array are accepted so hydrate
 * can decide whether a safe packet is possible.
 */
export function parseVisionJson(text: string): AiJson {
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new InterpretError(
      "invalid_json",
      "Could not parse an interpretation. Try another photo — we will not invent a cut list.",
    );
  }

  const parsed = AiJsonSchema.safeParse(raw);
  if (parsed.success) {
    if (!parsed.data.parts?.length) {
      throw new InterpretError(
        "incomplete_parts",
        "The reading came back without a parts list. Add another angle and try again — we will not fill in a stock template.",
      );
    }
    return parsed.data;
  }

  const loose = raw as Record<string, unknown>;
  const parts = Array.isArray(loose.parts)
    ? loose.parts.filter((p) => p && typeof p === "object")
    : [];
  if (!parts.length) {
    throw new InterpretError(
      "invalid_json",
      "The reading came back incomplete. Try another angle — we will not guess a cut list.",
    );
  }

  const overallRaw =
    loose.overall && typeof loose.overall === "object"
      ? (loose.overall as { w?: unknown; d?: unknown; h?: unknown })
      : undefined;
  const w = asFinite(overallRaw?.w);
  const d = asFinite(overallRaw?.d);
  const h = asFinite(overallRaw?.h);
  const retry = AiJsonSchema.safeParse({
    ...loose,
    parts,
    confidence:
      typeof loose.confidence === "number"
        ? clampInch(loose.confidence, 0, 1)
        : undefined,
    overall: w != null && d != null && h != null ? { w, d, h } : undefined,
  });
  if (retry.success) return retry.data;

  throw new InterpretError(
    "invalid_json",
    "The reading was not a usable shop packet. Try another photo — we will not silently substitute a template.",
  );
}

/**
 * Photo / URL / blueprint hydrate. Template supplies joinery routes,
 * hardware, and steps only. Cut-list parts always come from vision.
 */
export function hydrateVision(
  ai: AiJson,
  input: InterpretInput,
  photos: string[],
): Project {
  const template = pickTemplate(ai);
  const joinery =
    template ??
    (ai.category === "chair" || /chair|stool/i.test(ai.name ?? "")
      ? getTemplate("side-chair")
      : matchTemplate("bench", "bench")) ??
    getTemplate("bench");
  if (!joinery) {
    throw new InterpretError(
      "unsafe_packet",
      "No joinery route is available for this reading.",
    );
  }

  const candidates = (ai.parts ?? [])
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .map((part) => ({ part, measured: measuredOf(part) }));
  const sourced = candidates.filter((c) => hasSourcedDims(c.measured));

  if (sourced.length < 2) {
    throw new InterpretError(
      "incomplete_parts",
      "Could not source measurements for at least two boards. Add a side, underside, or a tape in frame — we will not substitute a stock cut list.",
    );
  }

  const overall = deriveOverall(ai, sourced);
  if (!overall) {
    throw new InterpretError(
      "missing_overall",
      "The reading did not include overall width, depth, and height, and the boards were not placed in space. Add a tape or a labeled plan and try again.",
    );
  }

  const rawOverall = {
    w: ai.overall?.w ?? overall.w,
    d: ai.overall?.d ?? overall.d,
    h: ai.overall?.h ?? overall.h,
  };
  const parts = toGraphParts(sourced, overall, rawOverall);
  if (parts.length < 2) {
    throw new InterpretError(
      "incomplete_parts",
      "Could not build a cut list from the photos. We will not fall back to template parts.",
    );
  }

  const scale = resolveScale(ai, sourced, overall);
  const speciesId =
    ai.speciesGuess &&
    [
      "maple",
      "walnut",
      "white-oak",
      "red-oak",
      "pine",
      "cedar",
      "poplar",
      "plywood-oak",
    ].includes(ai.speciesGuess)
      ? ai.speciesGuess
      : (joinery.defaultSpecies ?? "maple");

  // Draw the boards we read — do not start from the joinery template's
  // silhouette (lattice-back / counter-height stock sizes).
  const drawing = inferDrawing({
    id: `${joinery.id}-read`,
    category: ai.category ?? joinery.category,
    name: ai.name ?? joinery.name,
    interpretation: ai.interpretation ?? joinery.interpretation,
    parts,
    overall,
    drawing: ai.drawing as DrawingSpec | undefined,
  });

  return instantiate(
    {
      ...joinery,
      id: `${joinery.id}-read`,
      name: ai.name ?? joinery.name,
      category: ai.category ?? joinery.category,
      blurb: "Interpreted from photos.",
      overall,
      parts,
      drawing,
      interpretation: ai.interpretation ?? joinery.interpretation,
      confidence: ai.confidence ?? joinery.confidence,
      uncertainties:
        ai.uncertainties && ai.uncertainties.length
          ? ai.uncertainties
          : joinery.uncertainties,
      buyBoards: undefined,
      stack: undefined,
      stillBuy: undefined,
      doNotBuy: undefined,
    },
    {
      overall,
      rank: input.rank,
      toolsAvailable: normalizeTools(input.toolsAvailable),
      speciesId,
      photos,
      routeId:
        ai.suggestedRouteId && joinery.routes.some((r) => r.id === ai.suggestedRouteId)
          ? ai.suggestedRouteId
          : joinery.defaultRoute,
      overallSource: ai.overallSource ?? "estimated",
      sourceKind: input.kind,
      sourceLabel: input.url,
      interpretation: ai.interpretation ?? joinery.interpretation,
      confidence: clampInch(ai.confidence ?? joinery.confidence, 0, 1),
      uncertainties:
        ai.uncertainties && ai.uncertainties.length
          ? ai.uncertainties
          : joinery.uncertainties,
      partsFromPhotos: true,
      scaleConfidence: scale.scaleConfidence,
      scaleNotes: scale.scaleNotes,
      doNotCut: scale.doNotCut,
    },
  );
}
