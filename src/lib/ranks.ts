import type { Rank } from "./types";

export const RANK_META: Record<
  Rank,
  { label: string; shop: string; joinery: string }
> = {
  beginner: {
    label: "Beginner",
    shop: "Drill, circular saw or miter saw, sander, glue, clamps.",
    joinery: "Pocket holes, butt joints, metal brackets.",
  },
  novice: {
    label: "Novice",
    shop: "Adds a track saw or table saw, router, pocket-hole jig.",
    joinery: "Dados, rabbets, pocket screws, simple rabbets.",
  },
  apprentice: {
    label: "Apprentice",
    shop: "Table saw, jointer/planer or equivalent, mortiser or jig.",
    joinery: "Mortise & tenon, dowels, biscuits, drawer slides.",
  },
  craftsman: {
    label: "Craftsman",
    shop: "Machines plus sharpened hand tools and a finishing bench.",
    joinery: "Hand-cut dovetails, frame-and-panel, floating panels.",
  },
  master: {
    label: "Master",
    shop: "Full shop, including jigs you make yourself.",
    joinery: "Bent work, inlay, compound curves, period joinery.",
  },
};
