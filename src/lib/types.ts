export const RANKS = [
  "beginner",
  "novice",
  "apprentice",
  "craftsman",
  "master",
] as const;

export type Rank = (typeof RANKS)[number];

export type Axis = "w" | "d" | "h" | "fixed";

export type Stock = "solid" | "plywood" | "hardwood-ply" | "dowel";

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
};

export type Project = ProjectTemplate & {
  photoDataUrl?: string;
  overallSource: "catalog" | "labeled" | "estimated" | "assumed";
  sourceKind: "catalog" | "photo" | "url" | "blueprint";
  sourceLabel?: string;
  routeId: string;
  speciesId: string;
  rank: Rank;
};

export type CutRow = {
  id: string;
  name: string;
  qty: number;
  length: number;
  width: number;
  thickness: number;
  stock: Stock;
  grain: "length" | "width";
  notes?: string;
  boardFeet: number;
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
