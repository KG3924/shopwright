import { CATALOG } from "./catalog";
import { inferRole } from "./layout";
import { rankIndex } from "./format";
import { resolvePart, partBoardFeet } from "./parametric";
import {
  compileCutNotes,
  normalizeTools,
  offeredAndHidden,
  resolveConstructionRoute,
} from "./routes";
import { getSpecies } from "./species";
import { sourcesForZip } from "./sourcing";
import { techniquesFor } from "./techniques";
import { compileYield, inferFromStock, nextLetter } from "./yield";
import { formatCutAxis, isCutAxisUnknown, weakScale } from "./measure";
import type {
  CutRow,
  Overall,
  PartOverride,
  Project,
  ProjectTemplate,
  Rank,
  ScaleConfidence,
  ShopPacket,
  ShopTool,
} from "./types";

export function instantiate(
  template: ProjectTemplate,
  opts: {
    overall?: Overall;
    routeId?: string;
    speciesId?: string;
    rank?: Rank;
    toolsAvailable?: ShopTool[];
    photoDataUrl?: string;
    photos?: string[];
    partOverrides?: Record<string, PartOverride>;
    overallSource?: Project["overallSource"];
    sourceKind?: Project["sourceKind"];
    sourceLabel?: string;
    interpretation?: string;
    confidence?: number;
    uncertainties?: string[];
    partsFromPhotos?: boolean;
    scaleConfidence?: ScaleConfidence;
    scaleNotes?: string[];
    doNotCut?: boolean;
  } = {},
): Project {
  const photos =
    opts.photos ??
    (opts.photoDataUrl
      ? [opts.photoDataUrl]
      : template.image
        ? [template.image]
        : []);
  return {
    ...template,
    overall: opts.overall ?? { ...template.overall },
    routeId: opts.routeId ?? template.defaultRoute,
    speciesId: opts.speciesId ?? template.defaultSpecies,
    rank: opts.rank ?? "beginner",
    toolsAvailable: normalizeTools(opts.toolsAvailable),
    photoDataUrl: opts.photoDataUrl ?? photos[0],
    photos,
    partOverrides: opts.partOverrides ?? {},
    overallSource: opts.overallSource ?? "catalog",
    sourceKind: opts.sourceKind ?? "catalog",
    sourceLabel: opts.sourceLabel,
    interpretation: opts.interpretation ?? template.interpretation,
    confidence: opts.confidence ?? template.confidence,
    uncertainties: opts.uncertainties ?? template.uncertainties,
    partsFromPhotos: opts.partsFromPhotos,
    scaleConfidence: opts.scaleConfidence,
    scaleNotes: opts.scaleNotes,
    doNotCut: opts.doNotCut,
  };
}

export function compilePacket(project: Project, zip: string): ShopPacket {
  const resolved = resolveConstructionRoute(project);
  const route = resolved.route;
  const species = getSpecies(project.speciesId);
  const overrides = project.partOverrides ?? {};

  const cuts: CutRow[] = project.parts
    .filter((p) => {
      if (p.id === "stiles" || p.id === "rails") return route.id === "frame";
      if (p.id === "door" && route.id === "frame") return false;
      return true;
    })
    .map((p, i) => {
      const over = overrides[p.id];
      const d = resolvePart(p, project.overall, over);
      const locked = {
        length: over?.length != null,
        width: over?.width != null,
        thickness: over?.thickness != null,
        qty: over?.qty != null,
      };
      const cutMeasure = { measured: p.measured, locked };
      const inventStock =
        isCutAxisUnknown(cutMeasure, "thickness") || isCutAxisUnknown(cutMeasure, "width");
      const fromStock =
        p.fromStock ??
        (inventStock
          ? "measure first — stock unknown"
          : inferFromStock(p.stock, d.thickness, d.width));
      return {
        id: p.id,
        letter: p.letter ?? nextLetter(i),
        name: p.name,
        qty: d.qty,
        length: d.length,
        width: d.width,
        thickness: d.thickness,
        stock: p.stock,
        grain: p.grain,
        notes: compileCutNotes(p, route.id, resolved.runnable),
        fromStock,
        role: p.role ?? inferRole(p.id, p.name),
        instances: p.instances,
        boardFeet:
          p.stock === "sheet" ||
          (p.measured?.thickness.value == null && p.measured?.thickness.source === "unknown")
            ? 0
            : partBoardFeet(p, project.overall, over),
        measured: p.measured,
        locked,
        follows: {
          length: p.length.from,
          width: p.width.from,
          thickness: p.thickness.from,
        },
      };
    });

  const boardFeet = cuts.reduce((s, c) => s + c.boardFeet, 0);
  const volumeFt3 = boardFeet / 12;
  const weightLb = Math.round(volumeFt3 * species.density);

  const hardware = project.hardware.filter((h) => {
    if (!resolved.runnable) return !h.forRoutes;
    return !h.forRoutes || h.forRoutes.includes(route.id);
  });

  const steps = project.steps.filter((step) => {
    if (!resolved.runnable) return !step.forRoutes;
    if (step.forRoutes && !step.forRoutes.includes(route.id)) return false;
    if (step.minRank && rankIndex(project.rank) < rankIndex(step.minRank)) {
      return false;
    }
    if (
      step.skipAtAndAbove &&
      rankIndex(project.rank) >= rankIndex(step.skipAtAndAbove)
    ) {
      return false;
    }
    return true;
  });

  const techIds = steps.flatMap((s) => s.techniques);
  if (!project.indoor) techIds.push("outdoor-finish");
  if (species.outdoorOk === false && !project.indoor) {
    techIds.push("outdoor-finish");
  }
  const techniques = techniquesFor(techIds, project.rank);
  const yieldPack = compileYield(project, cuts);

  const warnings: string[] = [...resolved.warnings];
  if (!project.indoor && !species.outdoorOk) {
    warnings.push(
      `${species.name} is not a weather wood. Switch to cedar or white oak, or keep this piece indoors.`,
    );
  }
  if (project.overallSource !== "labeled" && project.sourceKind !== "catalog") {
    warnings.push(
      "Overall size is interpreted, not measured. Lock width, depth, and height to the space before you cut.",
    );
  }
  if (project.sourceKind !== "catalog") {
    warnings.push(
      project.partsFromPhotos
        ? "Parts and drawings were read from the photos, not a stock template. Confirm every ticket against a tape before you cut."
        : "Part drawings are compiled from this packet. Confirm every ticket against a tape before you cut.",
    );
  }
  if (project.scaleConfidence === "conflict") {
    warnings.push(
      "Scale conflict: labeled sizes and the boards we read do not agree. Confirm with a tape before you cut.",
    );
  } else if (project.scaleConfidence === "low") {
    warnings.push(
      "Scale confidence is low — no reliable tape or labeled dimension. Confirm overall W / D / H before you cut.",
    );
  }
  for (const note of project.scaleNotes ?? []) {
    if (note && !warnings.includes(note)) warnings.push(note);
  }
  const unknownTickets = cuts.filter(
    (c) =>
      formatCutAxis(c, "length") === "?" ||
      formatCutAxis(c, "width") === "?" ||
      formatCutAxis(c, "thickness") === "?",
  );
  if (unknownTickets.length) {
    warnings.push(
      `${unknownTickets.length} ticket${unknownTickets.length === 1 ? "" : "s"} print '?' where a size was not sourced. Measure that axis before you cut.`,
    );
  }
  const scaleHold =
    !!project.doNotCut ||
    weakScale(project.scaleConfidence) ||
    unknownTickets.length > 0;
  if (scaleHold && project.sourceKind !== "catalog") {
    warnings.push("Do not cut yet. Confirm scale and any '?' dimensions on the tickets.");
  }
  if (!resolved.runnable) {
    warnings.push("Do not cut yet. No construction route compiled.");
  }
  const doNotCut = !resolved.runnable || (project.sourceKind !== "catalog" && scaleHold);
  const lockedCount = cuts.filter(
    (c) => c.locked.length || c.locked.width || c.locked.thickness,
  ).length;
  if (lockedCount) {
    warnings.push(
      `${lockedCount} part${lockedCount === 1 ? "" : "s"} locked to a custom size and will not follow overall W/D/H. Reset a part to make it track again.`,
    );
  }
  if (species.id === "walnut" && boardFeet > 12) {
    warnings.push(
      "That's a serious walnut bill. Price 4/4 at a hardwood dealer before you commit the cut list.",
    );
  }
  if (
    resolved.runnable &&
    rankIndex(project.rank) < rankIndex(route.recommendedRank)
  ) {
    warnings.push(
      `This route is aimed at ${route.recommendedRank}s. The pocket-hole route is the safer first build.`,
    );
  }
  if (project.overall.w > 36 && project.category === "bookcase") {
    warnings.push(
      "Shelves over ~32\" want a thicker mid-span or a center divider if they're loaded with books.",
    );
  }
  const catalog = CATALOG.find((t) => t.id === project.id);
  if (
    project.buyBoards?.length &&
    catalog &&
    (catalog.overall.w !== project.overall.w ||
      catalog.overall.d !== project.overall.d ||
      catalog.overall.h !== project.overall.h)
  ) {
    warnings.push(
      "The board-by-board lumber list was written for the original labeled size. Recheck yield after you change overall W / D / H.",
    );
  }

  return {
    project,
    route,
    routeRunnable: resolved.runnable,
    routeStatuses: resolved.statuses,
    ...offeredAndHidden(resolved.statuses),
    cuts,
    boardFeet,
    weightLb,
    hardware,
    steps,
    techniques,
    species,
    sources: sourcesForZip(zip),
    warnings,
    doNotCut,
    ...yieldPack,
  };
}

export function nearestCatalog(project: Project): ProjectTemplate | undefined {
  return CATALOG.find((t) => t.id === project.id);
}
