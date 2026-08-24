import type { BackStyle, DrawingSpec, Overall, Part, Project, ProjectTemplate } from "./types";
import { isKnownDim } from "./measure";
import {
  applyRecoveredForm,
  ensureElevationOutlines,
  recoverFormLanguage,
  sanitizeOutline,
} from "./silhouette";

const ADIRONDACK = /\b(adirondack|westport|muskoka)\b/;
const LATTICE = /\b(lattice|chippendale|criss[- ]?cross|diamond back)\b/;
const XBACK = /\b(x-back|x back|crossed splat|cross-back)\b/;
const SPLAT = /\b(splat|fiddle|shield back)\b/;
const STOOL = /\b(stool|counter|bar stool|footring|foot rail)\b/;
const CHAIR = /\b(chair|stool|seat)\b/;

function blobOf(p: {
  id?: string;
  category?: string;
  name?: string;
  interpretation?: string;
  parts?: { name: string; notes?: string }[];
  drawing?: Partial<DrawingSpec>;
}): string {
  return [
    p.id,
    p.category,
    p.name,
    p.interpretation,
    ...(p.drawing?.visibleDetails ?? []),
    ...(p.parts ?? []).map((part) => `${part.name} ${part.notes ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function backFromBlob(blob: string): BackStyle {
  if (LATTICE.test(blob)) return "lattice";
  if (XBACK.test(blob)) return "x-back";
  if (SPLAT.test(blob)) return "splat";
  if (/\b(slat|fan back|picket)\b/.test(blob)) return "slat-fan";
  if (/\bsolid back|panel back\b/.test(blob)) return "solid";
  // Do not invent a lattice on a sculpted low-back just because the photo has a back.
  return "solid";
}

function partsBlob(parts: { name: string; role?: string }[] | undefined): string {
  return (parts ?? [])
    .map((p) => `${p.role ?? ""} ${p.name}`)
    .join(" ")
    .toLowerCase();
}

/** A back exists only when we saw back parts or the reading named a back style. */
export function hasBackEvidence(
  project: Pick<Project, "name" | "interpretation"> & {
    parts?: { name: string; role?: string }[];
    drawing?: Partial<DrawingSpec>;
  },
): boolean {
  const blob = blobOf(project);
  const parts = partsBlob(project.parts);
  if (project.drawing?.backStyle && project.drawing.backStyle !== "none") return true;
  if (LATTICE.test(blob) || XBACK.test(blob) || SPLAT.test(blob)) return true;
  if (/\b(slat|fan back|picket|solid back|panel back)\b/.test(blob)) return true;
  return /\b(back|stile|rail|splat|slat|lattice)\b/.test(parts);
}

function seatHeightFromParts(
  parts: Part[] | undefined,
  overall: Overall | undefined,
): number | undefined {
  if (!parts?.length || !overall?.h) return undefined;
  const seat = parts.find((p) => p.role === "seat" || /\bseat\b/i.test(p.name));
  const inst = seat?.instances?.find((p) => Number.isFinite(p.z));
  if (!inst) return undefined;
  const thickness = seat?.measured?.thickness;
  const t = isKnownDim(thickness) ? thickness.value : 0;
  const top = inst.z + t;
  if (top <= 0) return undefined;
  return Math.min(1, Math.max(0.2, top / overall.h));
}

function finishDrawing(spec: DrawingSpec): DrawingSpec {
  return ensureElevationOutlines(spec);
}

export function inferDrawing(
  project: Pick<
    Project,
    "id" | "category" | "name" | "parts" | "interpretation"
  > & { drawing?: DrawingSpec; overall?: Overall },
): DrawingSpec {
  const blob = blobOf(project);
  const recovered = recoverFormLanguage(blob);
  const fromPhoto = project.drawing
    ? applyRecoveredForm(project.drawing, recovered)
    : applyRecoveredForm({ family: "table" }, recovered);

  if (project.id === "feeder" || project.category === "feeder") {
    return { ...fromPhoto, family: "feeder" };
  }

  const namedAdirondack = project.id === "adirondack" || ADIRONDACK.test(blob);
  const keepAdirondack =
    namedAdirondack &&
    fromPhoto?.reclined !== false &&
    !LATTICE.test(blob) &&
    !STOOL.test(blob) &&
    fromPhoto?.backStyle !== "lattice" &&
    fromPhoto?.backStyle !== "x-back" &&
    fromPhoto?.backStyle !== "splat";

  if (keepAdirondack) {
    return finishDrawing({
      backStyle: "slat-fan",
      hasArms: true,
      hasFootring: false,
      seatShape: "square",
      seatHeightRatio: 0.42,
      ...fromPhoto,
      family: "chair",
      reclined: fromPhoto?.reclined ?? true,
    });
  }

  const isChair =
    fromPhoto?.family === "chair" ||
    project.id === "side-chair" ||
    project.category === "chair" ||
    CHAIR.test(blob);

  if (isChair) {
    const hasArmPart = (project.parts ?? []).some((p) => /\barm\b/i.test(p.name));
    const hasBack = hasBackEvidence({ ...project, drawing: fromPhoto });
    const hasFootringPart = (project.parts ?? []).some((p) =>
      /\b(footring|foot rail|stretcher)\b/i.test(p.name),
    );
    const fromParts = seatHeightFromParts(project.parts, project.overall);
    const seatShape =
      fromPhoto?.seatShape ??
      recovered.seatShape ??
      (/round|circular/.test(blob) ? "round" : "square");
    return finishDrawing({
      backStyle: fromPhoto?.backStyle ?? (hasBack ? backFromBlob(blob) : "none"),
      hasArms: fromPhoto?.hasArms ?? hasArmPart,
      hasFootring: fromPhoto?.hasFootring ?? hasFootringPart,
      reclined: fromPhoto?.reclined ?? false,
      ...fromPhoto,
      family: "chair",
      seatShape,
      seatProfile: fromPhoto?.seatProfile ?? recovered.seatProfile,
      seatFront: fromPhoto?.seatFront ?? recovered.seatFront,
      legStyle: fromPhoto?.legStyle ?? recovered.legStyle,
      backProfile: fromPhoto?.backProfile ?? recovered.backProfile,
      seatHeightRatio: fromPhoto?.seatHeightRatio ?? fromParts,
    });
  }

  if (
    fromPhoto?.family === "case" ||
    project.category === "bookcase" ||
    project.category === "cabinet" ||
    project.category === "case" ||
    project.id === "console" ||
    project.id === "bookcase" ||
    project.id === "cabinet"
  ) {
    return { ...fromPhoto, family: "case" };
  }

  if (fromPhoto?.family) return fromPhoto;
  return { family: "table" };
}

export function mergeDrawing(
  template: DrawingSpec | undefined,
  over: Partial<DrawingSpec> | undefined,
): DrawingSpec {
  const family = over?.family ?? template?.family ?? "table";
  const merged: DrawingSpec = { ...template, ...over, family };
  if (over?.sideOutline) merged.sideOutline = sanitizeOutline(over.sideOutline);
  if (over?.frontOutline) merged.frontOutline = sanitizeOutline(over.frontOutline);
  if (over?.planOutline) merged.planOutline = sanitizeOutline(over.planOutline);
  if (over?.visibleDetails?.length) merged.visibleDetails = over.visibleDetails.slice(0, 10);
  return merged;
}

export function drawingCaption(spec: DrawingSpec): string {
  if (spec.family === "feeder") return "Hip-roof hopper feeder";
  if (spec.family === "case") return "Casework — sides, shelves, back";
  if (spec.family === "table") return "Apron table — four legs, floating top";
  const back =
    spec.backStyle === "lattice"
      ? "diamond lattice back"
      : spec.backStyle === "x-back"
        ? "X-back"
        : spec.backStyle === "splat"
          ? "splat back"
          : spec.backStyle === "slat-fan"
            ? "fan slat back"
            : spec.backStyle === "solid"
              ? "solid back"
            : spec.backProfile === "hoop" || spec.backProfile === "windsor"
              ? "hoop / Windsor back"
              : "open back";
  const seat =
    spec.seatProfile && spec.seatProfile !== "flat"
      ? spec.seatShape && spec.seatShape !== "square"
        ? `${spec.seatProfile} ${spec.seatShape} seat`
        : `${spec.seatProfile} seat`
      : spec.seatShape === "round"
        ? "round seat"
        : spec.seatShape && spec.seatShape !== "square"
          ? `${spec.seatShape} seat`
          : "square seat";
  const legs =
    spec.legStyle && spec.legStyle !== "straight"
      ? spec.legStyle.replace("-", " ") + " legs"
      : null;
  return [
    spec.reclined ? "reclined" : "upright chair",
    back,
    seat,
    spec.seatFront && spec.seatFront !== "square" ? `${spec.seatFront} front` : null,
    spec.hasArms ? "arms" : "no arms",
    spec.hasFootring ? "footring" : null,
    legs,
    spec.seatHeightRatio && spec.seatHeightRatio >= 0.68
      ? "bar height"
      : spec.seatHeightRatio && spec.seatHeightRatio >= 0.55
        ? "counter height"
        : "dining height",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function isUprightChair(ai: {
  templateId?: string;
  category?: string;
  name?: string;
  interpretation?: string;
  drawing?: Partial<DrawingSpec>;
}): boolean {
  const blob = blobOf(ai);
  if (ai.drawing?.reclined === true && !LATTICE.test(blob) && !STOOL.test(blob)) {
    return false;
  }
  if (ai.drawing?.family === "chair" && ai.drawing.reclined === false) return true;
  if (LATTICE.test(blob) || XBACK.test(blob) || SPLAT.test(blob) || STOOL.test(blob)) {
    return true;
  }
  if (ai.drawing?.backStyle && ai.drawing.backStyle !== "slat-fan") return true;
  if ((ai.category === "chair" || CHAIR.test(blob)) && !ADIRONDACK.test(blob)) {
    return true;
  }
  return false;
}

export function isAdirondackReading(ai: {
  templateId?: string;
  category?: string;
  name?: string;
  interpretation?: string;
  drawing?: Partial<DrawingSpec>;
}): boolean {
  const blob = blobOf({
    id: ai.templateId,
    category: ai.category,
    name: ai.name,
    interpretation: ai.interpretation,
  });
  if (isUprightChair(ai)) return false;
  return (
    ai.templateId === "adirondack" ||
    ADIRONDACK.test(blob) ||
    (ai.drawing?.reclined === true && ai.drawing.backStyle === "slat-fan")
  );
}

export function templateDrawing(t: ProjectTemplate): DrawingSpec {
  return inferDrawing(t);
}
