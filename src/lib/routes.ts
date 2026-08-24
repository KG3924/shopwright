import { inferRole } from "./layout";
import type {
  ConstructionRoute,
  Part,
  PartRole,
  Project,
  Rank,
  RouteStatus,
  ShopTool,
} from "./types";
import { SHOP_TOOLS } from "./types";

export const SHOP_TOOL_META: Record<ShopTool, string> = {
  drill: "Drill",
  "miter-saw": "Miter saw",
  "kreg-jig": "Kreg jig",
  clamps: "Clamps",
  sander: "Sander",
  "table-saw": "Table saw",
  mortiser: "Mortiser",
  chisels: "Chisels",
  "tenon-saw": "Tenon saw",
  "marking-gauge": "Marking gauge",
  plane: "Plane",
};

export type RouteGate = {
  minRank: Rank;
  /** Every listed tool must be on the bench. */
  tools?: ShopTool[];
  /** At least one of these must be on the bench. */
  anyOf?: ShopTool[];
};

/** Hard gates by route id. Piece graphs can override via minRank / requiredTools. */
export const ROUTE_GATES: Record<string, RouteGate> = {
  pocket: { minRank: "beginner", tools: ["kreg-jig"] },
  mortise: { minRank: "apprentice", anyOf: ["mortiser", "chisels"] },
  dowel: { minRank: "novice", tools: ["drill"] },
  dado: { minRank: "novice", tools: ["table-saw"] },
  dovetail: { minRank: "craftsman", anyOf: ["chisels", "mortiser"] },
  frame: { minRank: "apprentice", tools: ["table-saw"] },
  screwed: { minRank: "beginner", tools: ["drill"] },
  plugged: { minRank: "novice", tools: ["drill"] },
  adjustable: { minRank: "beginner", tools: ["drill"] },
};

export const POCKET_CUT_NOTE =
  "Pocket / butt — cut the listed length. Do not invent extra length.";

export const MORTISE_CUT_NOTE =
  "Tongue and the pocket it fits into — cut the listed length. Do not invent extra stock.";

const JOINERY_NOTE_ROLES = new Set<PartRole>([
  "leg",
  "stretcher",
  "apron",
  "apron-long",
  "apron-short",
  "rail",
]);

export function isShopTool(value: unknown): value is ShopTool {
  return typeof value === "string" && (SHOP_TOOLS as readonly string[]).includes(value);
}

export function normalizeTools(raw: unknown): ShopTool[] {
  if (!Array.isArray(raw)) return [];
  return SHOP_TOOLS.filter((tool) => raw.includes(tool));
}

export function toolsAvailableOf(
  project: Pick<Project, "toolsAvailable">,
): ShopTool[] {
  return normalizeTools(project.toolsAvailable);
}

export function gateFor(route: ConstructionRoute): RouteGate {
  const table = ROUTE_GATES[route.id];
  return {
    minRank: route.minRank ?? table?.minRank ?? route.recommendedRank,
    tools: route.requiredTools ?? table?.tools ?? [],
    anyOf: table?.anyOf,
  };
}

export function statusForRoute(
  route: ConstructionRoute,
  _rank: Rank,
  tools: readonly ShopTool[],
): RouteStatus {
  const gate = gateFor(route);
  const reasons: string[] = [];
  // Rank is shelved — tools on the bench gate the route.
  for (const tool of gate.tools ?? []) {
    if (!tools.includes(tool)) {
      reasons.push(`Needs ${SHOP_TOOL_META[tool]}`);
    }
  }
  if (gate.anyOf?.length && !gate.anyOf.some((tool) => tools.includes(tool))) {
    reasons.push(
      `Needs ${gate.anyOf.map((tool) => SHOP_TOOL_META[tool]).join(" or ")}`,
    );
  }
  return { id: route.id, runnable: reasons.length === 0, reasons };
}

export function offeredAndHidden(statuses: RouteStatus[]): {
  routesOffered: string[];
  routesHidden: string[];
} {
  return {
    routesOffered: statuses.filter((s) => s.runnable).map((s) => s.id),
    routesHidden: statuses.filter((s) => !s.runnable).map((s) => s.id),
  };
}

export function routeStatusesFor(project: Project): RouteStatus[] {
  const tools = toolsAvailableOf(project);
  return project.routes.map((route) => statusForRoute(route, project.rank, tools));
}

/** Compiled packet label when rank/tools cannot run any route. */
export const NO_ROUTE_ID = "none";
export const NO_ROUTE_NAME = "No route";

/** Compiled packet label when rank/tools cannot run any route. */
export const NO_ROUTE: ConstructionRoute = {
  id: NO_ROUTE_ID,
  name: NO_ROUTE_NAME,
  recommendedRank: "beginner",
  summary: "The tools on the bench cannot compile a build method.",
  joinery: "none — don't cut yet",
  tools: [],
  tradeoffs: "",
  hiddenWork: "",
};

export type ResolvedRoute = {
  route: ConstructionRoute;
  runnable: boolean;
  steered: boolean;
  statuses: RouteStatus[];
  warnings: string[];
};

export function resolveConstructionRoute(project: Project): ResolvedRoute {
  const statuses = routeStatusesFor(project);
  const requested =
    project.routes.find((r) => r.id === project.routeId) ?? project.routes[0];
  if (!requested) {
    return {
      route: NO_ROUTE,
      runnable: false,
      steered: false,
      statuses,
      warnings: ["No construction route is defined for this piece."],
    };
  }

  const requestedStatus = statuses.find((s) => s.id === requested.id);
  if (requestedStatus?.runnable) {
    return {
      route: requested,
      runnable: true,
      steered: false,
      statuses,
      warnings: [],
    };
  }

  const fallback = project.routes.find(
    (r) => statuses.find((s) => s.id === r.id)?.runnable,
  );
  const why = requestedStatus?.reasons.join("; ") || "these tools";

  if (fallback) {
    return {
      route: fallback,
      runnable: true,
      steered: true,
      statuses,
      warnings: [
        `${requested.name} can't run with these tools (${why}). Using ${fallback.name} instead.`,
      ],
    };
  }

  return {
    route: NO_ROUTE,
    runnable: false,
    steered: false,
    statuses,
    warnings: [],
  };
}

function joinNotes(...parts: Array<string | undefined>): string | undefined {
  const text = parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .filter((p, i, all) => all.indexOf(p) === i)
    .join(" ");
  return text || undefined;
}

function defaultRouteNote(part: Part, routeId: string): string | undefined {
  const role = part.role ?? inferRole(part.id, part.name);
  if (!JOINERY_NOTE_ROLES.has(role)) return undefined;
  if (routeId === "pocket") return POCKET_CUT_NOTE;
  if (routeId === "mortise") return MORTISE_CUT_NOTE;
  return undefined;
}

/** Rewrite cut-list notes for the route that actually compiled. Never invents length. */
export function compileCutNotes(
  part: Part,
  routeId: string,
  runnable: boolean,
): string | undefined {
  if (!runnable) return part.notes;
  const fromGraph = part.routeNotes?.[routeId];
  return joinNotes(part.notes, fromGraph ?? defaultRouteNote(part, routeId));
}

export function toggleTool(tools: unknown, tool: ShopTool): ShopTool[] {
  const current = normalizeTools(tools);
  return current.includes(tool)
    ? current.filter((t) => t !== tool)
    : [...SHOP_TOOLS.filter((t) => current.includes(t) || t === tool)];
}
