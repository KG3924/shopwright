export const RANKS = [
  "beginner",
  "novice",
  "apprentice",
  "craftsman",
  "master",
] as const;

export type Rank = (typeof RANKS)[number];

export type Axis = "w" | "d" | "h" | "fixed";

export type Stock = "solid" | "plywood" | "hardwood-ply" | "dowel" | "sheet";

export const MAX_PHOTOS = 6;

export type Dim = {
  from: Axis;
  /** If `from` is an overall axis, result = overall[axis] + offset. If fixed, offset is the inch value. */
  offset: number;
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
  /** Shop letter on the cut list (A, B, F…). Inferred if omitted. */
  letter?: string;
  /** Which board or sheet this is cut from. */
  fromStock?: string;
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
  summary: string;
  joinery: string;
  tools: string[];
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
};

export type ShopPacket = {
  project: Project;
  route: ConstructionRoute;
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
