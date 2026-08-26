import type { ScaleConfidence } from "./types";

/** Process hold — not a danger banner. */
export const DONT_CUT_YET = "Don't cut yet";

/**
 * Master-shop words beginners bounce off. Fine in craft-rule files.
 * Chrome copy uses the beginner name; a lettered drawing does the teaching.
 * Haunch has no short synonym — skip it in chrome.
 */
export const UNEXPLAINED_JARGON_RE =
  /\b(crest|haunches?|stiles?|rabbets?|stretchers?|dados?|kerfs?|tenons?|mortises?|aprons?)\b/i;

/**
 * Short beginner names. Use next to a lettered drawing — do not dump
 * these glosses into banners.
 */
export const SHOP_PLAIN = {
  crest: "top bar of the chair back",
  stretcher: "lower support connecting the legs",
  stile: "vertical side of a door or frame",
  rabbet: "step-shaped cut along the edge",
  rail: "horizontal piece of a frame",
  apron: "frame under the tabletop, between the legs",
  mortiseTenon: "tongue and the pocket it fits into",
  dado: "three-sided trench for a shelf",
  kerf: "slot the blade removes",
} as const;

export type HoldFlags = {
  doNotCut?: boolean;
  routeRunnable?: boolean;
  scaleConfidence?: ScaleConfidence;
  /** Count of ticket axes that still print `?`. Hold copy stays silent about them. */
  unknownAxes?: number;
};

/**
 * IKEA-style: a few standardized holds, not seven equivalent banners.
 * Tickets already print `?` / guessed — verify — do not lecture that again.
 */
export const HOLD_BODY = {
  tools:
    "No build method matches the tools on the bench. Add tools, or pick a method that can run.",
  conflict:
    "Labeled sizes don't match. Confirm overall width, depth, and height with a tape.",
  photo:
    "One photo can label what you see. It cannot authorize a cut list. Confirm overall size with a tape before you cut.",
  lock: "Confirm the sizes you haven't locked before you cut.",
} as const;

export function formatHoldBody(flags: HoldFlags): string {
  if (flags.routeRunnable === false) return HOLD_BODY.tools;
  if (flags.scaleConfidence === "conflict") return HOLD_BODY.conflict;
  if (flags.scaleConfidence === "low") return HOLD_BODY.photo;
  return HOLD_BODY.lock;
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
  homeKicker: "Photo in. Labeled packet out.",
  homeTitle: "Turn a photo into a labeled packet.",
  homeLead:
    "One photo can label what you see. It cannot authorize a cut list. Add a tape when you can, then lock unmarked sizes before you cut.",
  homeStepPhotos: "Up to six angles",
  homeStepReading: "What the piece is",
  homeStepDrawings: "Of this piece",
  homeStepCutList: "Board by board",
  homePhotosTitle: "Add photos — one is enough to label",
  homePhotosBody:
    "Front, side, underside, a tape if you have one. Up to six. Then interpret once.",
  homeNoteLabel: "What to look for (optional)",
  homeNotePlaceholder:
    "Saddle seat, rolled front, tapered legs — name anything the photo might flatten.",
  homeCatalogTitle: "Example packets",
  homeCatalogBlurb:
    "Example packets — a known form you can open, not the photo product path.",
  homeRecentTitle: "Recent pieces",
  homeRecentBlurb: "Open one to restore the photos and the packet.",
  studioEmptyTitle: "No piece on the bench",
  studioEmptyBody: "Start with photos, a link, or an example packet.",
  studioRecentBlurb: "Or open a piece you already read.",
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
    "Letters on the drawing match the tickets. A photo labels the piece — it does not authorize the cut list.",
  drawingsCatalog:
    "Cut to the numbers on the tickets. Unlocked parts follow overall width, depth, and height.",
  explode:
    "Letters on the drawing match the legend. Open assembly steps when you are ready to build.",
  tickets:
    "One ticket per board. Letter and size lead. The drawing next to them is how you tell the parts apart.",
  scaleCaption:
    "Not to scale. Cut to the tickets. If you use plywood, check its real thickness before you cut.",
  cutList:
    "Letter, thickness, width, length, and which board it comes from. Type a size to lock it. Unlock to follow overall width, depth, and height again.",
  lumberFirst:
    "Cut the boards you will use first. Leave spare on the rack until you need it.",
  assemblySummary: "Assembly steps — open when you are ready to build",
  buildLead:
    "Letters on the drawing match the tickets. This is how to do the joint — not a lecture.",
  inferred: "Labeled from the photo",
  inferredCatalog: "Not visible — assumed",
  masterHint: "Asks about this packet.",
  masterEmpty:
    "Ask how to cut a three-sided trench for a shelf without a table saw, whether walnut is worth it at this size, or what changes if the alcove is 62 inches.",
} as const;

/**
 * Beginner names and one-line how-to for technique drawings.
 * Placeholders {host} {guest} {extra} become ticket letters.
 * Craft-rule files may still use shop words; this chrome must not.
 */
export const TECHNIQUE_PLAIN: Record<
  string,
  {
    name: string;
    bluf: string;
    hostFallback: string;
    guestFallback: string;
    extraFallback: string;
  }
> = {
  "square-cut": {
    name: "Cut square",
    bluf: "Mark {host} against a square. Cut on the waste side of the line.",
    hostFallback: "the board",
    guestFallback: "the offcut",
    extraFallback: "the stack",
  },
  "pocket-hole": {
    name: "Pocket screws",
    bluf: "Drill angled holes in {guest}. Drive screws into {host}.",
    hostFallback: "the post",
    guestFallback: "the connecting rail",
    extraFallback: "the third board",
  },
  "glue-up": {
    name: "Glue a panel",
    bluf: "Joint the edges of {host} so they kiss. Glue, clamp, wait, then scrape the bead.",
    hostFallback: "the panel",
    guestFallback: "the mate",
    extraFallback: "the caul",
  },
  "clamp-up": {
    name: "Clamp the box",
    bluf: "Dry-fit {host} and {guest} until the diagonals match. Then glue and clamp.",
    hostFallback: "the posts",
    guestFallback: "the rails",
    extraFallback: "the square",
  },
  dado: {
    name: "Shelf trench",
    bluf: `Cut a ${SHOP_PLAIN.dado} in {host}. {guest} slides in with hand pressure.`,
    hostFallback: "the side",
    guestFallback: "the shelf",
    extraFallback: "the stop",
  },
  "mortise-tenon": {
    name: "Tongue and pocket",
    bluf: `The ${SHOP_PLAIN.mortiseTenon}. Pocket in {host}. Tongue on {guest}.`,
    hostFallback: "the post",
    guestFallback: "the rail",
    extraFallback: "the shoulder",
  },
  dovetail: {
    name: "Dovetails",
    bluf: "Scribe {host} and {guest}. Saw to the line. The joint closes with a firm push.",
    hostFallback: "the pin board",
    guestFallback: "the tail board",
    extraFallback: "the drawer side",
  },
  "taper-leg": {
    name: "Taper the legs",
    bluf: "Leave the top of {host} full so the rail has a landing. Taper the two inside faces.",
    hostFallback: "the leg",
    guestFallback: "the rail",
    extraFallback: "the jig",
  },
  "drawer-slides": {
    name: "Drawer slides",
    bluf: "Build the box 1\" narrower than the opening in {host}. Spacer blocks keep both slides level.",
    hostFallback: "the case",
    guestFallback: "the drawer box",
    extraFallback: "the spacer",
  },
  "finish-oil": {
    name: "Oil finish",
    bluf: "Wipe oil on {host}. Wait. Wipe all of it off. Repeat tomorrow.",
    hostFallback: "the piece",
    guestFallback: "the cloth",
    extraFallback: "the rag can",
  },
  resaw: {
    name: "Split a board",
    bluf: `Rip {host} flat first. Then stand the strip on edge. Two passes meet in the middle. That gap is the ${SHOP_PLAIN.kerf}.`,
    hostFallback: "the board",
    guestFallback: "the strip",
    extraFallback: "the fence",
  },
  "hip-cleat": {
    name: "Inside hip cleat",
    bluf: "The two faces of {host} butt — they do not cross. {extra} inside is what holds the hip.",
    hostFallback: "the roof",
    guestFallback: "the post",
    extraFallback: "the cleat",
  },
  "half-lap": {
    name: "Crossing laps",
    bluf: `{host} — ${SHOP_PLAIN.stile}. {extra} — ${SHOP_PLAIN.rail}. {guest} lives in the opening. Where strips cross, cut half the thickness from each so the faces sit flush.`,
    hostFallback: "the vertical side",
    guestFallback: "the lattice",
    extraFallback: "the horizontal piece",
  },
  "finish-paint": {
    name: "Paint",
    bluf: "Ease the edges of {host} you will touch. Prime, then two color coats.",
    hostFallback: "the piece",
    guestFallback: "the underside",
    extraFallback: "the primer",
  },
  "outdoor-finish": {
    name: "Outdoor finish",
    bluf: "Raise {host} on feet. Gap the slats so water does not sit. Oil is easier to renew than a film.",
    hostFallback: "the piece",
    guestFallback: "the slats",
    extraFallback: "the feet",
  },
  "wood-movement": {
    name: "Let the top move",
    bluf: "Screw {guest} tight at the front of {host}. Slot it at the back. Do not glue the top all the way around.",
    hostFallback: "the top",
    guestFallback: "the frame under it",
    extraFallback: "the slot",
  },
  "edge-banding": {
    name: "Cover the plywood edge",
    bluf: "Iron a thin strip onto {host}. Overhang a hair, trim flush, then finish the edge with the face.",
    hostFallback: "the plywood edge",
    guestFallback: "the banding",
    extraFallback: "the trimmer",
  },
};

export function packetChromeStrings(): string[] {
  return [
    ...Object.values(PACKET_COPY),
    ...Object.values(HOLD_BODY),
    ...Object.values(SHOP_PLAIN),
    ...Object.values(TECHNIQUE_PLAIN).flatMap((t) => [
      t.name,
      t.bluf,
      t.hostFallback,
      t.guestFallback,
      t.extraFallback,
    ]),
  ];
}
