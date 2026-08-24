import { z } from "zod";
import { getTemplate, matchTemplate } from "../catalog";
import { instantiate } from "../compile";
import { inferDrawing, isAdirondackReading, isUprightChair } from "../drawing";
import { inferRole, isPartRole } from "../layout";
import {
  asBackProfile,
  asLegStyle,
  asSeatFront,
  asSeatProfile,
  asSeatShape,
  recoverFormLanguage,
  sanitizeOutline,
} from "../silhouette";
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
import { runInferFill } from "./infer";
import { normalizeTools } from "../routes";
import type {
  Axis3,
  Dim,
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

const BACK_STYLES = ["lattice", "x-back", "splat", "slat-fan", "solid", "none"] as const;
const DRAWING_FAMILIES = ["table", "case", "chair", "feeder"] as const;
const maybeStr = z.union([z.string(), z.null()]).optional();
const maybeNum = z.union([z.number().finite(), z.null()]).optional();
const maybeBool = z.union([z.boolean(), z.null()]).optional();
const maybeOutline = z.array(z.any()).nullish();

const DrawingSchema = z
  .object({
    family: maybeStr,
    backStyle: maybeStr,
    hasArms: maybeBool,
    hasFootring: maybeBool,
    seatShape: maybeStr,
    seatProfile: maybeStr,
    seatFront: maybeStr,
    seatDishIn: maybeNum,
    legStyle: maybeStr,
    legTaperToIn: maybeNum,
    legSplayDeg: maybeNum,
    backProfile: maybeStr,
    seatHeightRatio: maybeNum,
    reclined: maybeBool,
    constructionConfidence: maybeNum,
    visibleDetails: z.array(z.string()).nullish(),
    sideOutline: maybeOutline,
    frontOutline: maybeOutline,
    planOutline: maybeOutline,
  })
  .passthrough()
  .optional();

export const AiJsonSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  templateId: z.string().nullable().optional(),
  interpretation: z.string().optional(),
  confidence: z.number().optional(),
  formConfidence: z.number().optional(),
  constructionConfidence: z.number().optional(),
  overall: OverallSchema.optional(),
  overallSource: z.enum(["labeled", "estimated", "assumed"]).optional(),
  scaleConfidence: z.enum(["high", "low", "conflict"]).optional(),
  scaleNotes: z.array(z.string()).optional(),
  speciesGuess: z.string().optional(),
  uncertainties: z.array(z.string()).optional(),
  suggestedRouteId: z.string().optional(),
  visibleDetails: z.array(z.string()).optional(),
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

export const WOOD_TRANSLATION_NOTE =
  "Source piece appears metal/plastic; translated to wood build.";

const NON_WOOD_RE =
  /\b(metal|steel|stainless|aluminum|aluminium|chrome|iron|alloy|tubular|sheet[\s-]?metal|plastic|pvc|resin|polypropylene|acrylic|polycarbonate|fiberglass)\b/i;

const WOOD_SPECIES = [
  "maple",
  "walnut",
  "white-oak",
  "red-oak",
  "pine",
  "cedar",
  "poplar",
  "plywood-oak",
] as const;

const WOOD_STOCK = ["solid", "plywood", "hardwood-ply", "dowel"] as const;

export function sourceLooksNonWood(blob: string): boolean {
  return NON_WOOD_RE.test(blob);
}

const CAD_RE =
  /\b(cad|hidden lines?|line drawing|wireframe|orthographic|product diagram|technical drawing|vector drawing)\b/i;

export function sourceLooksCad(blob: string): boolean {
  return CAD_RE.test(blob);
}

function preferConstructedOutlines(ai: AiJson): boolean {
  const blob = materialBlob(ai);
  return sourceLooksNonWood(blob) || sourceLooksCad(blob);
}

function materialBlob(ai: AiJson): string {
  return [
    ai.name,
    ai.category,
    ai.interpretation,
    ai.speciesGuess,
    ...(ai.visibleDetails ?? []),
    ...(ai.uncertainties ?? []),
    ...(ai.parts ?? []).map((p) => `${p.name} ${p.stock ?? ""} ${p.notes ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ");
}

const BUY_HARDWARE_NAME =
  /\b(hinges?|rivets?|clevis(?:\s+pins?)?|cotter(?:\s+pins?)?|bolts?|machine screws?|tube connectors?|folding stays?|gas stays?|pivot pins?|hairpins?)\b/i;

function isBuyHardwarePart(part: { name: string; role?: string }): boolean {
  return BUY_HARDWARE_NAME.test(part.name);
}

function looksLikeChairOrStool(ai: AiJson): boolean {
  const blob = materialBlob(ai);
  if (/\b(chair|stool|fold(?:ing|able)?)\b/i.test(blob)) return true;
  const family =
    ai.drawing && typeof ai.drawing === "object" && "family" in ai.drawing
      ? String((ai.drawing as { family?: string }).family ?? "")
      : "";
  if (family === "chair") return true;
  const roles = (ai.parts ?? []).map((p) => (p.role ?? "").toLowerCase());
  return (
    roles.includes("seat") &&
    roles.some((r) => r === "leg" || r === "brace" || r === "stretcher")
  );
}

/**
 * Material does not change the furniture family. A metal folding stool is
 * still chair / side-chair even if the model dumped category "other".
 */
function withShopFamily(ai: AiJson): AiJson {
  if (!sourceLooksNonWood(materialBlob(ai))) return ai;
  if (!looksLikeChairOrStool(ai)) return ai;
  const category = !ai.category || ai.category === "other" ? "chair" : ai.category;
  const templateId =
    ai.templateId === "adirondack" || ai.templateId === "side-chair"
      ? ai.templateId
      : "side-chair";
  return { ...ai, category, templateId };
}

function woodStockOf(raw: string | undefined, nonWood: boolean): string {
  if (raw && (WOOD_STOCK as readonly string[]).includes(raw)) return raw;
  if (!nonWood && raw === "sheet") return "sheet";
  return "solid";
}

function stripSheetMetalThickness(measured: PartMeasured, nonWood: boolean): PartMeasured {
  if (!nonWood) return measured;
  const t = measured.thickness;
  if (t.source === "measured" && t.value != null && t.value > 0 && t.value < 0.25) {
    return {
      ...measured,
      thickness: {
        value: null,
        source: "unknown",
        confidence: 0,
        note: t.note ?? "Sheet-metal / tube-wall thickness is not wood stock — measure the blank.",
      },
    };
  }
  return measured;
}

function withWoodTranslationNote(text: string | undefined, nonWood: boolean): string | undefined {
  if (!nonWood) return text;
  const body = text?.trim() ?? "";
  if (/translated to (a )?wood/i.test(body)) return body || WOOD_TRANSLATION_NOTE;
  return body ? `${body} ${WOOD_TRANSLATION_NOTE}` : WOOD_TRANSLATION_NOTE;
}

function pickTemplate(ai: AiJson) {
  const drawing = drawingFromAi(ai);
  const reading = { ...ai, templateId: ai.templateId ?? undefined, drawing };
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

function dimFromMeasured(
  name: string,
  axis: "length" | "width" | "thickness",
  measured: MeasuredDim,
  value: number,
  overall: Overall,
): Dim {
  // A named seat-height band is a shop standard, not a proportion of overall H.
  if (
    axis === "length" &&
    measured.source === "inferred" &&
    measured.note?.includes("seat height")
  ) {
    return { from: "fixed", offset: value };
  }
  return inferDim(name, axis, value, overall);
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
      length: dimFromMeasured(name, "length", measured.length, lengthVal, overall),
      width: dimFromMeasured(name, "width", measured.width, widthVal, overall),
      thickness: dimFromMeasured(name, "thickness", measured.thickness, thicknessVal, overall),
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

function drawingFromAi(ai: AiJson): DrawingSpec | undefined {
  const d = ai.drawing;
  if (!d && !ai.visibleDetails?.length && ai.constructionConfidence == null) {
    return undefined;
  }
  const details = [
    ...(Array.isArray(ai.visibleDetails) ? ai.visibleDetails : []),
    ...(Array.isArray(d?.visibleDetails) ? d.visibleDetails : []),
  ]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 10);
  const familyRaw = typeof d?.family === "string" ? d.family.toLowerCase() : undefined;
  const backRaw = typeof d?.backStyle === "string" ? d.backStyle.toLowerCase() : undefined;
  return {
    family: (DRAWING_FAMILIES as readonly string[]).includes(familyRaw ?? "")
      ? (familyRaw as DrawingSpec["family"])
      : undefined,
    backStyle: (BACK_STYLES as readonly string[]).includes(backRaw ?? "")
      ? (backRaw as DrawingSpec["backStyle"])
      : undefined,
    hasArms: typeof d?.hasArms === "boolean" ? d.hasArms : undefined,
    hasFootring: typeof d?.hasFootring === "boolean" ? d.hasFootring : undefined,
    reclined: typeof d?.reclined === "boolean" ? d.reclined : undefined,
    seatHeightRatio: typeof d?.seatHeightRatio === "number" ? d.seatHeightRatio : undefined,
    seatShape: asSeatShape(d?.seatShape),
    seatProfile: asSeatProfile(d?.seatProfile),
    seatFront: asSeatFront(d?.seatFront),
    seatDishIn: typeof d?.seatDishIn === "number" ? d.seatDishIn : undefined,
    legStyle: asLegStyle(d?.legStyle),
    legTaperToIn: typeof d?.legTaperToIn === "number" ? d.legTaperToIn : undefined,
    legSplayDeg: typeof d?.legSplayDeg === "number" ? d.legSplayDeg : undefined,
    backProfile: asBackProfile(d?.backProfile),
    constructionConfidence:
      typeof ai.constructionConfidence === "number"
        ? ai.constructionConfidence
        : (d?.constructionConfidence ?? undefined),
    visibleDetails: details.length ? details : undefined,
    preferConstructedOutline: preferConstructedOutlines(ai) || undefined,
    sideOutline: preferConstructedOutlines(ai) ? undefined : sanitizeOutline(d?.sideOutline),
    frontOutline: preferConstructedOutlines(ai) ? undefined : sanitizeOutline(d?.frontOutline),
    planOutline: preferConstructedOutlines(ai) ? undefined : sanitizeOutline(d?.planOutline),
  } as DrawingSpec;
}

function formHonestyNote(ai: AiJson, drawing: DrawingSpec): string | undefined {
  const blob = [
    ai.name,
    ai.interpretation,
    ...(ai.visibleDetails ?? []),
    ...(drawing.visibleDetails ?? []),
    ...(ai.parts ?? []).map((p) => `${p.name} ${p.notes ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const recovered = recoverFormLanguage(blob);
  const namedCurve = recovered.seatProfile && recovered.seatProfile !== "flat";
  const rawProfile = asSeatProfile(ai.drawing?.seatProfile);
  const rawWasBox = !rawProfile || rawProfile === "flat";
  if (namedCurve && (rawWasBox || drawing.seatProfile === "flat")) {
    return "Seat curve was named in the reading — we kept that profile instead of a flat square slab.";
  }
  return undefined;
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
  const reading = withShopFamily(ai);
  const template = pickTemplate(reading);
  const joinery =
    template ??
    (reading.category === "chair" || /chair|stool/i.test(reading.name ?? "")
      ? getTemplate("side-chair")
      : matchTemplate("bench", "bench")) ??
    getTemplate("bench");
  if (!joinery) {
    throw new InterpretError(
      "unsafe_packet",
      "No joinery route is available for this reading.",
    );
  }

  const nonWood = sourceLooksNonWood(materialBlob(reading));
  const droppedHardware = (reading.parts ?? []).some(
    (p) => p && isBuyHardwarePart(p),
  );
  const candidates = (reading.parts ?? [])
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .filter((p) => !(nonWood && isBuyHardwarePart(p)))
    .map((part) => ({
      part: { ...part, stock: woodStockOf(part.stock, nonWood) },
      measured: stripSheetMetalThickness(measuredOf(part), nonWood),
    }));
  const visionSourced = candidates.filter((c) => hasSourcedDims(c.measured));

  if (visionSourced.length < 2) {
    throw new InterpretError(
      "incomplete_parts",
      "Could not source measurements for at least two boards. Add a side, underside, or a tape in frame — we will not substitute a stock cut list.",
    );
  }

  const overall = deriveOverall(reading, visionSourced);
  if (!overall) {
    throw new InterpretError(
      "missing_overall",
      "The reading did not include overall width, depth, and height, and the boards were not placed in space. Add a tape or a labeled plan and try again.",
    );
  }

  // Safe infer-fill after the vision gate. Cannot invent a 2-board
  // packet; may fill twins and leftover unknown axes, then re-admit
  // those boards. Fills from this pass do not release Don't-cut.
  const drawingIn = drawingFromAi(reading);
  const inferred = runInferFill(
    candidates.map(({ part, measured }) => ({
      name: part.name.trim(),
      role: part.role,
      qty: Math.max(1, Math.round(Number(part.qty) || 1) || 1),
      measured,
      instances: part.instances,
    })),
    {
      overall,
      overallSource: reading.overallSource,
      scaleConfidence: reading.scaleConfidence,
      name: reading.name,
      category: reading.category,
      interpretation: reading.interpretation,
      drawing: drawingIn,
    },
  );
  const sourced = candidates
    .map((c, i) => ({
      part: {
        ...c.part,
        instances: inferred.parts[i]?.instances ?? c.part.instances,
      },
      measured: inferred.parts[i]?.measured ?? c.measured,
    }))
    .filter((c) => hasSourcedDims(c.measured));

  const rawOverall = {
    w: reading.overall?.w ?? overall.w,
    d: reading.overall?.d ?? overall.d,
    h: reading.overall?.h ?? overall.h,
  };
  const parts = toGraphParts(sourced, overall, rawOverall);
  if (parts.length < 2) {
    throw new InterpretError(
      "incomplete_parts",
      "Could not build a cut list from the photos. We will not fall back to template parts.",
    );
  }

  const scale = resolveScale(reading, sourced, overall);
  const speciesId =
    reading.speciesGuess && (WOOD_SPECIES as readonly string[]).includes(reading.speciesGuess)
      ? reading.speciesGuess
      : (joinery.defaultSpecies ?? "maple");

  const drawing = inferDrawing({
    id: `${joinery.id}-read`,
    category: reading.category ?? joinery.category,
    name: reading.name ?? joinery.name,
    interpretation: reading.interpretation ?? joinery.interpretation,
    parts,
    overall,
    drawing: drawingIn,
  });

  if (drawing.seatProfile && drawing.seatProfile !== "flat") {
    for (const p of parts) {
      if (p.role === "seat" && !p.notes) {
        const dish = drawing.seatDishIn ? `, dish ~${drawing.seatDishIn}"` : "";
        const front =
          drawing.seatFront && drawing.seatFront !== "square"
            ? `, ${drawing.seatFront} front`
            : "";
        p.notes = `Blank is rectangular. Shape ${drawing.seatProfile} seat${dish}${front}.`;
      }
      if (p.role === "leg" && !p.notes && drawing.legStyle && drawing.legStyle !== "straight") {
        p.notes = `Shape ${drawing.legStyle.replace("-", " ")}${
          drawing.legTaperToIn ? ` to ${drawing.legTaperToIn}"` : ""
        }${drawing.legSplayDeg ? `, splay ~${drawing.legSplayDeg}°` : ""}.`;
      }
    }
  }

  const honesty = formHonestyNote(reading, drawing);
  const interpretation = withWoodTranslationNote(
    reading.interpretation ?? joinery.interpretation,
    nonWood,
  );
  const hardwareNote =
    nonWood && droppedHardware
      ? "Hinges, pivot pins, and folding stays are buy hardware — not cut-list stock."
      : undefined;
  const uncertainties = [
    ...(reading.uncertainties && reading.uncertainties.length
      ? reading.uncertainties
      : joinery.uncertainties),
    ...(honesty ? [honesty] : []),
    ...(nonWood &&
    !(reading.uncertainties ?? []).some((u) => /translated to (a )?wood/i.test(u))
      ? [WOOD_TRANSLATION_NOTE]
      : []),
    ...(hardwareNote ? [hardwareNote] : []),
  ];

  return instantiate(
    {
      ...joinery,
      id: `${joinery.id}-read`,
      name: reading.name ?? joinery.name,
      category: reading.category ?? joinery.category,
      blurb: "Interpreted from photos.",
      overall,
      parts,
      drawing,
      interpretation,
      confidence: reading.formConfidence ?? reading.confidence ?? joinery.confidence,
      uncertainties,
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
        reading.suggestedRouteId && joinery.routes.some((r) => r.id === reading.suggestedRouteId)
          ? reading.suggestedRouteId
          : joinery.defaultRoute,
      overallSource: reading.overallSource ?? "estimated",
      sourceKind: input.kind,
      sourceLabel: input.url,
      interpretation,
      confidence: clampInch(reading.confidence ?? joinery.confidence, 0, 1),
      uncertainties,
      partsFromPhotos: true,
      scaleConfidence: scale.scaleConfidence,
      scaleNotes: scale.scaleNotes,
      doNotCut: scale.doNotCut,
    },
  );
}
