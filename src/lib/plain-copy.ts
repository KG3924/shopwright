import type { ScaleConfidence } from "./types";

/** Shop hold headline — one short line, then one what-to-do sentence. */
export const DONT_CUT_YET = "Don't cut yet";

/**
 * Master-shop words beginners bounce off. Fine in craft-rule files;
 * chrome copy may use them only with an immediate gloss in the same phrase.
 */
export const UNEXPLAINED_JARGON_RE =
  /\b(crest|haunches?|stiles?|rabbets?)\b/i;

export type HoldFlags = {
  doNotCut?: boolean;
  routeRunnable?: boolean;
  scaleConfidence?: ScaleConfidence;
  /** Count of ticket axes that still print `?`. */
  unknownAxes?: number;
};

/**
 * One BLUF sentence: what's wrong + what to do.
 * Scale notes, missing-axis essays, and template lectures stay off this line —
 * those details live on tickets (`?`, guessed — verify) and the cut list.
 */
export function formatHoldBody(flags: HoldFlags): string {
  if (flags.routeRunnable === false) {
    return "No build method matches the tools on the bench. Add tools, or pick a method that can run.";
  }
  const unknown = flags.unknownAxes ?? 0;
  if (flags.scaleConfidence === "conflict") {
    return unknown > 0
      ? "Labeled sizes don't match the boards we read. Confirm overall width, depth, and height — and any ? on the tickets — with a tape before you cut."
      : "Labeled sizes don't match the boards we read. Confirm overall width, depth, and height with a tape before you cut.";
  }
  if (flags.scaleConfidence === "low") {
    return unknown > 0
      ? "Sizes came from the photo, not a tape. Confirm overall width, depth, and height — and any ? on the tickets — before you cut."
      : "Sizes came from the photo, not a tape. Confirm overall width, depth, and height before you cut.";
  }
  if (unknown > 0) {
    return unknown === 1
      ? "One size on the tickets is still ?. Measure that before you cut."
      : `${unknown} sizes on the tickets are still ?. Measure those before you cut.`;
  }
  if (flags.doNotCut) {
    return "Some sizes are guessed from the photo. Confirm them on the tickets before you cut.";
  }
  return "Confirm the sizes on the tickets before you cut.";
}

/** Duplicate scale / photo / template / don't-cut lectures that used to stack. */
export const HOLD_WARNING_RE =
  /don't cut yet|do not cut yet|scale confidence is low|scale conflict|overall size is interpreted|stock template|sourced axis|tickets? print ['’']?\?|no tape or labeled|no construction route compiled|confirm every ticket against a tape|confirm overall w\s*\/\s*d\s*\/\s*h/i;

export function isHoldWarning(text: string): boolean {
  return HOLD_WARNING_RE.test(text);
}

export function holdWarningCount(warnings: readonly string[]): number {
  return warnings.filter(isHoldWarning).length;
}

/** User-facing chrome — home, studio, shop-drawings. Not craft-rule prose. */
export const PACKET_COPY = {
  homeKicker: "Photo in. Shop packet out.",
  homeTitle: "Turn a photo into a cut list you can build from.",
  homeLead:
    "One photo is enough to start. A side, the underside, or a tape in the shot makes the sizes more trustworthy. Then confirm any ? before you cut.",
  homeStepPhotos: "Up to six angles",
  homeStepReading: "What the piece is",
  homeStepDrawings: "Of this piece",
  homeStepCutList: "Board by board",
  homePhotosTitle: "Add photos — one is enough to start",
  homePhotosBody:
    "Front, side, underside, a tape if you have one. Up to six. Then interpret once.",
  homeNoteLabel: "What to look for (optional)",
  homeNotePlaceholder:
    "Saddle seat, rolled front, tapered legs — name anything the photo might flatten.",
  homeCatalogBlurb:
    "Start from a known form. Same packet — drawings, per-part sizes, wood, and a build method.",
  studioEmptyTitle: "No piece on the bench",
  studioEmptyBody: "Start with photos, a link, or a studio piece.",
  studioFit: "Overall width, depth, and height. Unlocked parts follow. Size a single board on the cut list if it needs to be different.",
  toolsTitle: "Tools on the bench",
  toolsBlurb:
    "Check what you have. A build method only compiles if these tools can actually run it.",
  rankAdvanced: "Advanced — skill level",
  rankHint:
    "Left on Beginner. Tools pick the build method, not rank. Rank does not change the drawings.",
  routesTitle: "How it goes together",
  routesBlurb:
    "A method compiles when the tools on the bench can run it. Switching methods changes fasteners, steps, and cut notes — not just the words.",
  drawingsFromPhotos:
    "Drawn from the boards in the photos. Cut to the tickets, not the pictures. Confirm any ? with a tape.",
  drawingsCatalog:
    "Cut to the numbers on the tickets. Unlocked parts follow overall width, depth, and height.",
  explode:
    "Letters on the drawing match the legend. Open assembly steps when you are ready to build.",
  tickets:
    "One ticket per board. Letter and size lead so seats, legs, and the cross-bar under the seat (stretcher) do not look the same.",
  scaleCaption:
    "Not to scale. Cut to the tickets. If you use plywood, check its real thickness before you cut grooves.",
  cutList:
    "Letter, thickness, width, length, and which board it comes from. Type a size to lock it. Unlock to follow overall width, depth, and height again.",
  lumberFirst:
    "Cut the boards you will use first. Leave spare on the rack until you need it.",
  assemblySummary: "Assembly steps — open when you are ready to build",
  inferred: "Guessed from the photo — confirm before you cut",
  masterHint: "Asks about this packet.",
} as const;

export function packetChromeStrings(): string[] {
  return Object.values(PACKET_COPY);
}
