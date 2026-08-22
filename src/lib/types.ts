export const RANKS = [
  "beginner",
  "novice",
  "apprentice",
  "craftsman",
  "master",
] as const;

export type Rank = (typeof RANKS)[number];

/** Tools the builder says are on the bench. Gates which construction routes can compile. */
export const SHOP_TOOLS = [
  "drill",
  "miter",
  "kreg",
  "table-saw",
  "mortiser",
] as const;

export type ShopTool = (typeof SHOP_TOOLS)[number];

export type Axis = "w" | "d" | "h" | "fixed";

export type Axis3 = "x" | "y" | "z";

export type Stock = "solid" | "plywood" | "hardwood-ply" | "dowel" | "sheet";

export const MAX_PHOTOS = 6;

export const PART_ROLES = [
  "top",
  "seat",
  "leg",
  "apron-long",
  "apron-short",
  "apron",
  "side",
  "shelf",
  "bottom",
  "back",
  "rail",
  "stile",
  "splat",
  "slat",
  "arm",
  "stretcher",
  "cleat",
  "door",
  "panel",
  "post",
  "roof",
  "brace",
  "kick",
  "other",
] as const;

export type PartRole = (typeof PART_ROLES)[number];

/** One copy of a part in the piece. Origin is front-left-floor; x right, y back, z up. */
export type PartInstance = {
  x: number;
  y: number;
  z: number;
  /** World axis the board's length runs along. */
  lengthAlong?: Axis3;
  /** World axis the board's width (face) runs along. */
  widthAlong?: Axis3;
};

export type Dim = {
  from: Axis;
  /** If `from` is an overall axis, result = overall[axis] + offset. If fixed, offset is the inch value. */
  offset: number;
};

export const DIM_SOURCES = ["measured", "inferred", "unknown"] as const;
export type DimSource = (typeof DIM_SOURCES)[number];

export const SCALE_CONFIDENCES = ["high", "low", "conflict"] as const;
export type ScaleConfidence = (typeof SCALE_CONFIDENCES)[number];

/** Per-axis measure truth. `value` is null when the axis was not sourced. */
export type MeasuredDim = {
  value: number | null;
  source: DimSource;
  /** 0–1. */
  confidence: number;
  photoIndex?: number;
  note?: string;
};

export type PartMeasured = {
  length: MeasuredDim;
  width: MeasuredDim;
  thickness: MeasuredDim;
};

export type Part = {
  id: string;
  name: string;
  qty: number;
  length: Dim;
  width: Dim;
  thickness: Dim;
  stock: Stock;
  grain: "length" | "width";
  notes?: string;
  /** Route-specific cut-list notes. Compiler writes these onto the ticket. */
  routeNotes?: Record<string, string>;
  /** Shop letter on the cut list (A, B, F…). Inferred if omitted. */
  letter?: string;
  /** Which board or sheet this is cut from. */
  fromStock?: string;
  role?: PartRole;
  /** Where each copy sits. Drawings compile from this when present. */
  instances?: PartInstance[];
  /** Photo/URL/blueprint measure truth. Catalog parts omit this. */
  measured?: PartMeasured;
};

/** Locks a part so it no longer follows overall W/D/H. */
export type PartOverride = {
  length?: number;
  width?: number;
  thickness?: number;
  qty?: number;
};

export type ConstructionRoute = {
  id: string;
  name: string;
  recommendedRank: Rank;
  /** Hard gate. Defaults to the route-id table, then recommendedRank. */
  minRank?: Rank;
  summary: string;
  joinery: string;
  tools: string[];
  /** Shop-tool enum this route must have. Defaults to the route-id table. */
  requiredTools?: ShopTool[];
  tradeoffs: string;
  hiddenWork: string;
};

export type HardwareItem = {
  id: string;
  name: string;
  qty: number;
  spec: string;
  aisle: string;
  /** Where each fastener actually goes. Shop-plan quality. */
  where?: string;
  forRoutes?: string[];
};

export type BuildStep = {
  id: string;
  title: string;
  body: string;
  techniques: string[];
  minRank?: Rank;
  skipAtAndAbove?: Rank;
  forRoutes?: string[];
};

export type BuyBoard = {
  id: string;
  label: string;
  stock: string;
  bdft: number;
  role: string;
  yields: string;
  body: string;
  spare?: boolean;
};

export type BackStyle =
  | "lattice"
  | "x-back"
  | "splat"
  | "slat-fan"
  | "solid"
  | "none";

export type SeatShape = "square" | "round";

/** How to draw the piece — from the photo, not from a catalog silhouette. */
export type DrawingSpec = {
  family: "table" | "case" | "chair" | "feeder";
  backStyle?: BackStyle;
  hasArms?: boolean;
  hasFootring?: boolean;
  seatShape?: SeatShape;
  /** Seat height as a fraction of overall H. Dining ~0.48, counter ~0.61, bar ~0.72. */
  seatHeightRatio?: number;
  reclined?: boolean;
};

export type Overall = { w: number; d: number; h: number };

export type ProjectTemplate = {
  id: string;
  name: string;
  category: string;
  blurb: string;
  image: string;
  overall: Overall;
  thickness: number;
  defaultSpecies: string;
  defaultRoute: string;
  indoor: boolean;
  interpretation: string;
  confidence: number;
  uncertainties: string[];
  routes: ConstructionRoute[];
  parts: Part[];
  hardware: HardwareItem[];
  steps: BuildStep[];
  /** Locked dimension stack, shop-plan style. */
  stack?: string[];
  /** Explicit lumber to buy. Inferred from the cut list if omitted. */
  buyBoards?: BuyBoard[];
  stillBuy?: string[];
  doNotBuy?: string[];
  /** How shop drawings should look. Inferred from the piece if omitted. */
  drawing?: DrawingSpec;
};

export type Project = ProjectTemplate & {
  photoDataUrl?: string;
  photos: string[];
  partOverrides: Record<string, PartOverride>;
  overallSource: "catalog" | "labeled" | "estimated" | "assumed";
  sourceKind: "catalog" | "photo" | "url" | "blueprint";
  sourceLabel?: string;
  routeId: string;
  speciesId: string;
  rank: Rank;
  /** Empty means no tool-gated route can run — rank alone never invents joinery. */
  toolsAvailable: ShopTool[];
  /** True when the cut list came from the photos, not a stock template. */
  partsFromPhotos?: boolean;
  /** Piece-level scale quality from a tape, label, or conflicting cues. */
  scaleConfidence?: ScaleConfidence;
  scaleNotes?: string[];
  /** Weak or conflicted scale — confirm before you cut. */
  doNotCut?: boolean;
};

export type CutRow = {
  id: string;
  letter: string;
  name: string;
  qty: number;
  length: number;
  width: number;
  thickness: number;
  stock: Stock;
  grain: "length" | "width";
  notes?: string;
  fromStock: string;
  boardFeet: number;
  role: PartRole;
  instances?: PartInstance[];
  locked: {
    length: boolean;
    width: boolean;
    thickness: boolean;
    qty: boolean;
  };
  follows: {
    length: Axis;
    width: Axis;
    thickness: Axis;
  };
  measured?: PartMeasured;
};

export type RouteStatus = {
  id: string;
  runnable: boolean;
  reasons: string[];
};

export type ShopPacket = {
  project: Project;
  route: ConstructionRoute;
  /** False when rank/tools cannot run any route — hardware/steps stay route-agnostic. */
  routeRunnable: boolean;
  routeStatuses: RouteStatus[];
  cuts: CutRow[];
  boardFeet: number;
  weightLb: number;
  hardware: HardwareItem[];
  steps: BuildStep[];
  techniques: Technique[];
  species: Species;
  sources: LumberSource[];
  warnings: string[];
  boards: BuyBoard[];
  stillBuy: string[];
  doNotBuy: string[];
  stack: string[];
  /** True when scale is weak/conflict or tickets still have unknown axes. */
  doNotCut?: boolean;
};

export type Technique = {
  id: string;
  name: string;
  autoUntil: Rank;
  tools: string[];
  body: string;
  safety?: string;
};

export type Species = {
  id: string;
  name: string;
  density: number;
  janka: number;
  cost: "$" | "$$" | "$$$" | "$$$$";
  indoor: string;
  stain: string;
  weather: string;
  movement: string;
  notes: string;
  outdoorOk: boolean;
  typicalStock: string;
};

export type LumberSource = {
  id: string;
  name: string;
  kind: "big-box" | "hardwood" | "specialty";
  city: string;
  miles: number;
  carries: string;
  note: string;
  regions: string[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function projectPhotos(project: Project): string[] {
  if (project.photos?.length) return project.photos;
  if (project.photoDataUrl) return [project.photoDataUrl];
  if (project.image) return [project.image];
  return [];
}
