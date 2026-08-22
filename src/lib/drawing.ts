import type { BackStyle, DrawingSpec, Project, ProjectTemplate } from "./types";

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
  parts?: { name: string }[];
}): string {
  return [
    p.id,
    p.category,
    p.name,
    p.interpretation,
    ...(p.parts ?? []).map((part) => part.name),
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
  return "lattice";
}

export function inferDrawing(
  project: Pick<
    Project,
    "id" | "category" | "name" | "parts" | "interpretation"
  > & { drawing?: DrawingSpec },
): DrawingSpec {
  const blob = blobOf(project);
  const fromPhoto = project.drawing;

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
    return {
      backStyle: "slat-fan",
      hasArms: true,
      hasFootring: false,
      seatShape: "square",
      seatHeightRatio: 0.42,
      ...fromPhoto,
      family: "chair",
      reclined: fromPhoto?.reclined ?? true,
    };
  }

  const isChair =
    fromPhoto?.family === "chair" ||
    project.id === "side-chair" ||
    project.category === "chair" ||
    CHAIR.test(blob);

  if (isChair) {
    const hasArmPart = (project.parts ?? []).some((p) => /\barm\b/i.test(p.name));
    return {
      family: "chair",
      backStyle: fromPhoto?.backStyle ?? backFromBlob(blob),
      hasArms: fromPhoto?.hasArms ?? hasArmPart,
      hasFootring: fromPhoto?.hasFootring ?? STOOL.test(blob),
      seatShape: fromPhoto?.seatShape ?? (/round|circular/.test(blob) ? "round" : "square"),
      reclined: fromPhoto?.reclined ?? false,
      seatHeightRatio:
        fromPhoto?.seatHeightRatio ?? (STOOL.test(blob) ? 0.61 : 0.48),
    };
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
  return { ...template, ...over, family };
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
              : "open back";
  return [
    spec.reclined ? "reclined Adirondack" : "upright chair",
    back,
    spec.seatShape === "round" ? "round seat" : "square seat",
    spec.hasArms ? "arms" : "no arms",
    spec.hasFootring ? "footring" : null,
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
