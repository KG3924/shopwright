import { TECHNIQUE_PLAIN } from "./plain-copy";
import type { CutRow, PartRole } from "./types";

export type TechniqueCast = {
  host?: string;
  guest?: string;
  extra?: string;
};

type CutRef = Pick<CutRow, "id" | "letter" | "name" | "role">;

type CastPref = {
  host: PartRole[];
  guest: PartRole[];
  extra?: PartRole[];
  hostName?: RegExp;
  guestName?: RegExp;
  extraName?: RegExp;
};

const CAST_PREF: Record<string, CastPref> = {
  "square-cut": { host: ["leg", "top", "seat", "side"], guest: [], hostName: /./ },
  "pocket-hole": {
    host: ["leg", "stile", "side", "post"],
    guest: ["apron-long", "apron", "apron-short", "stretcher", "rail", "shelf"],
  },
  "glue-up": { host: ["seat", "top", "panel"], guest: [] },
  "clamp-up": {
    host: ["leg", "stile", "side", "post"],
    guest: ["apron-long", "apron", "stretcher", "rail", "shelf"],
  },
  dado: {
    host: ["side", "back", "leg"],
    guest: ["shelf", "bottom", "top", "panel"],
  },
  "mortise-tenon": {
    host: ["leg", "stile", "post", "side"],
    guest: ["apron-long", "apron", "apron-short", "stretcher", "rail"],
  },
  dovetail: {
    host: ["side", "panel"],
    guest: ["side", "panel", "bottom"],
    hostName: /drawer|front|pin/i,
    guestName: /drawer|tail|side/i,
  },
  "taper-leg": { host: ["leg", "post"], guest: ["apron", "apron-long"] },
  "drawer-slides": {
    host: ["side"],
    guest: ["panel", "bottom", "door"],
    guestName: /drawer/i,
  },
  "finish-oil": { host: ["top", "seat", "side"], guest: [] },
  resaw: { host: ["slat"], guest: [], hostName: /slat|clapboard|1×12|1x12/i },
  "hip-cleat": {
    host: ["roof"],
    guest: ["post"],
    extra: ["cleat"],
    extraName: /cleat/i,
  },
  "half-lap": {
    host: ["stile", "rail"],
    hostName: /stile/i,
    guest: ["slat", "splat"],
    guestName: /lattice|strip|slat/i,
    extra: ["rail"],
    extraName: /rail|crest/i,
  },
  "finish-paint": { host: ["seat", "leg", "top"], guest: [] },
  "outdoor-finish": { host: ["slat", "seat", "side"], guest: ["post"] },
  "wood-movement": {
    host: ["top", "seat"],
    guest: ["apron-long", "apron", "apron-short", "rail"],
  },
  "edge-banding": { host: ["side", "door", "panel", "shelf"], guest: [] },
};

/** Joinery first — finish drawings only fill a step that has nothing else. */
export const FIGURE_PRIORITY = [
  "mortise-tenon",
  "pocket-hole",
  "dado",
  "dovetail",
  "half-lap",
  "hip-cleat",
  "resaw",
  "taper-leg",
  "drawer-slides",
  "wood-movement",
  "edge-banding",
  "glue-up",
  "clamp-up",
  "square-cut",
  "finish-oil",
  "finish-paint",
  "outdoor-finish",
] as const;

export type TechniqueFigureId = (typeof FIGURE_PRIORITY)[number];

export function hasTechniqueFigure(id: string): id is TechniqueFigureId {
  return (FIGURE_PRIORITY as readonly string[]).includes(id);
}

export function figuresForStep(ids: readonly string[]): TechniqueFigureId[] {
  const want = new Set(ids);
  const ordered = FIGURE_PRIORITY.filter((id) => want.has(id));
  const joinery = ordered.filter((id) => !id.startsWith("finish"));
  if (joinery.length) return joinery.slice(0, 2);
  return ordered.slice(0, 1);
}

function pickCut(
  cuts: readonly CutRef[],
  roles: readonly PartRole[],
  nameRe: RegExp | undefined,
  used: Set<string>,
): CutRef | undefined {
  if (nameRe && nameRe.source !== ".") {
    const named = cuts.find(
      (c) => !used.has(c.id) && nameRe.test(`${c.id} ${c.name}`),
    );
    if (named) return named;
  }
  for (const role of roles) {
    const hit = cuts.find((c) => !used.has(c.id) && c.role === role);
    if (hit) return hit;
  }
  if (nameRe?.source === ".") {
    return cuts.find((c) => !used.has(c.id));
  }
  return undefined;
}

export function techniqueCast(
  cuts: readonly CutRef[],
  techniqueId: string,
): TechniqueCast {
  const pref = CAST_PREF[techniqueId];
  if (!pref) return {};
  const used = new Set<string>();
  const host = pickCut(cuts, pref.host, pref.hostName, used);
  if (host) used.add(host.id);
  const guest = pickCut(cuts, pref.guest, pref.guestName, used);
  if (guest) used.add(guest.id);
  const extra = pickCut(cuts, pref.extra ?? [], pref.extraName, used);
  return {
    host: host?.letter,
    guest: guest?.letter,
    extra: extra?.letter,
  };
}

export function techniqueLettersKey(cast: TechniqueCast): string {
  return [cast.host, cast.guest, cast.extra].filter(Boolean).join("·");
}

function mark(
  letter: string | undefined,
  fallback: string,
): string {
  return letter && letter.trim() ? letter : fallback;
}

export function techniqueCaption(
  techniqueId: string,
  cuts: readonly CutRef[],
): string | undefined {
  const copy = TECHNIQUE_PLAIN[techniqueId];
  if (!copy) return undefined;
  const cast = techniqueCast(cuts, techniqueId);
  return copy.bluf
    .replaceAll("{host}", mark(cast.host, copy.hostFallback))
    .replaceAll("{guest}", mark(cast.guest, copy.guestFallback))
    .replaceAll("{extra}", mark(cast.extra, copy.extraFallback));
}

export function techniquePlainName(id: string): string {
  return TECHNIQUE_PLAIN[id]?.name ?? id;
}
