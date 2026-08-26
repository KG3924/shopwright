import type {
  BuildStep,
  ConstructionRoute,
  DrawingSpec,
  FinishKind,
  HardwareItem,
  Part,
  SeatKind,
} from "../types";

export type PhotoReading = {
  name?: string;
  category?: string;
  interpretation?: string;
  visibleDetails?: string[];
  uncertainties?: string[];
  speciesGuess?: string;
  seat?: SeatKind;
  finish?: FinishKind;
  drawing?: Partial<DrawingSpec>;
  parts?: Array<{ name: string; role?: string; notes?: string; stock?: string }>;
};

const WOOD_SPECIES = [
  "maple",
  "walnut",
  "white-oak",
  "red-oak",
  "pine",
  "cedar",
  "poplar",
  "plywood-oak",
] as const;

/**
 * Lattice joinery is a positive interpret tag, never a catalog template
 * and never a parts-name check (Windsor / slat / cane would leak the same way).
 * Splat / solid / crest / none / unknown / missing → not lattice.
 */
export function isLatticeTagged(reading: PhotoReading): boolean {
  return reading.drawing?.backStyle === "lattice";
}

export function isPaintTagged(reading: PhotoReading): boolean {
  if (reading.finish === "paint" || reading.drawing?.finishKind === "paint") return true;
  if (reading.finish === "clear" || reading.finish === "unknown") return false;
  if (reading.drawing?.finishKind === "clear" || reading.drawing?.finishKind === "unknown") {
    return false;
  }
  const blob = [
    reading.interpretation,
    ...(reading.visibleDetails ?? []),
    ...(reading.uncertainties ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  if (/\b(natural hardwood|clear (?:coat|finish)|oil finish|unfinished)\b/i.test(blob)) {
    return false;
  }
  return /\b(paint(?:ed|ing)?|enamel|primer|milk paint)\b/i.test(blob);
}

export function isUpholsteredSeat(
  reading: PhotoReading,
  seat: { name: string; role?: string; notes?: string; stock?: string },
  sourceIsNonWood = false,
): boolean {
  if (sourceIsNonWood) return false;
  if (seat.role !== "seat" && !/\bseat\b/i.test(seat.name)) return false;
  const kind = reading.seat ?? reading.drawing?.seatKind;
  if (kind === "upholstered") return true;
  if (kind === "solid" || kind === "unknown") return false;
  const seatBlob = `${seat.name} ${seat.notes ?? ""} ${seat.stock ?? ""}`;
  const global = `${reading.interpretation ?? ""} ${(reading.visibleDetails ?? []).join(" ")}`;
  if (/\bupholster/i.test(`${seatBlob} ${global}`)) return true;
  if (/\bfabric\b/i.test(seatBlob)) return true;
  return /\b(fabric|upholstered)\s+seat\b/i.test(global);
}

export function photoSpeciesId(guess: string | undefined): string {
  if (guess && (WOOD_SPECIES as readonly string[]).includes(guess)) return guess;
  return "maple";
}

export function photoProjectId(category?: string, family?: string): string {
  const raw = (family || category || "piece").toLowerCase();
  if (raw === "chair" || raw === "stool") return "chair-read";
  if (raw === "feeder") return "feeder-read";
  if (
    raw === "case" ||
    raw === "bookcase" ||
    raw === "cabinet" ||
    raw === "console"
  ) {
    return "case-read";
  }
  if (raw === "table" || raw === "bench" || raw === "coffee-table") return "table-read";
  return "photo-read";
}

export function applyUpholsteredSeat(parts: Part[], reading: PhotoReading, nonWood: boolean): Part[] {
  return parts.map((part) => {
    if (!isUpholsteredSeat(reading, part, nonWood)) return part;
    return {
      ...part,
      stock: "plywood",
      notes:
        part.notes && /webbing|foam|fabric|plywood/i.test(part.notes)
          ? part.notes
          : "Plywood blank. Webbing, foam, and fabric — not a solid glue-up.",
    };
  });
}

const PHOTO_ROUTES: ConstructionRoute[] = [
  {
    id: "pocket",
    name: "Pocket-screw frame",
    recommendedRank: "beginner",
    summary:
      "Stretchers and the seat screw into the legs from the inside. Corner blocks under the seat. The chair that gets used this month.",
    joinery: "Pocket holes + glue on stretchers. Corner blocks under the seat.",
    tools: ["Kreg jig", "miter saw", "drill", "clamps"],
    tradeoffs:
      "Pocket holes on the inside of the legs. Fine on a clear or painted chair. Not a period piece.",
    hiddenWork: "Corner blocks under the seat.",
  },
  {
    id: "mortise",
    name: "Mortise-and-tenon frame",
    recommendedRank: "craftsman",
    summary:
      "Haunched tenons on every stretcher and back rail. Seat on corner blocks, not glued around. The chair that outlives the finish.",
    joinery:
      "Tongue and the pocket it fits into on stretchers and rails. Seat in a rabbet or on corner blocks.",
    tools: ["Mortiser or chisels", "tenon saw", "marking gauge", "plane"],
    tradeoffs: "A full weekend in joinery. Worth it in walnut or oak.",
    hiddenWork: "Haunches at the top of the front-leg mortises.",
  },
];

function photoHardware(opts: {
  lattice: boolean;
  paint: boolean;
  upholstered: boolean;
}): HardwareItem[] {
  const items: HardwareItem[] = [
    {
      id: "kreg-chair",
      name: "Pocket-hole screws",
      qty: 32,
      spec: '1¼" fine-thread #8, square drive',
      aisle: "Kreg / wood joinery",
      where:
        "Two per stretcher end into the legs (inside face). Seat underside into the legs and any back stiles.",
      forRoutes: ["pocket"],
    },
    {
      id: "corner-blocks",
      name: "Corner blocks",
      qty: 4,
      spec: '¾" × ¾" × ~4", with #8 × 1¼" screws',
      aisle: "Cut from scrap, or chair-corner hardware",
      where:
        "Under the seat at each corner, screwed into the seat and into the adjacent legs.",
    },
    {
      id: "glue-ch",
      name: "Wood glue",
      qty: 1,
      spec: "Titebond II, 8 oz",
      aisle: "Adhesives",
      where: opts.upholstered
        ? "Every stretcher-to-leg joint and the back-rail joints. Not a film around an upholstered seat."
        : "Every stretcher-to-leg joint, a solid-seat glue-up if the seat is solid, and the back-rail joints.",
    },
  ];
  if (opts.upholstered) {
    items.push({
      id: "upholstery-pack",
      name: "Seat webbing, foam, and fabric",
      qty: 1,
      spec: 'Jute or elastic webbing, 2" foam, upholstery fabric to cover seat A',
      aisle: "Upholstery",
      where:
        "Plywood seat A. Stretch webbing, add foam, then fabric. This is not a solid-wood glue-up.",
    });
  }
  if (opts.lattice) {
    items.push({
      id: "pins-ch",
      name: "23-ga pins or ⅝\" brads",
      qty: 1,
      spec: 'Box of ⅝" pins',
      aisle: "Fasteners",
      where: "Lattice crossings and lattice-to-frame while the glue sets.",
    });
  }
  if (opts.paint) {
    items.push({
      id: "primer-ch",
      name: "Primer + enamel",
      qty: 1,
      spec: "Bonding primer and waterborne enamel, quart of each",
      aisle: "Paint",
      where: "Whole chair. Sand 180, prime, sand 220, two color coats.",
    });
  }
  return items;
}

function photoSteps(opts: {
  lattice: boolean;
  paint: boolean;
  upholstered: boolean;
  hasSolidSeat: boolean;
}): BuildStep[] {
  const steps: BuildStep[] = [
    {
      id: "sc1",
      title: "Mill the legs first",
      body: "Rip to the square on the tickets. Joint and plane so matching legs read the same. Cut pairs together. Mark face sides. If the legs disagree, the seat will.",
      techniques: ["square-cut"],
    },
  ];
  if (opts.upholstered) {
    steps.push({
      id: "sc2u",
      title: "Cut the plywood seat blank",
      body: "Seat A is the ticket rectangle. Cut plywood to those inches. Webbing, foam, and fabric go on after the frame is together. Do not glue up solid boards for this seat.",
      techniques: ["square-cut"],
    });
  } else if (opts.hasSolidSeat) {
    steps.push({
      id: "sc2",
      title: "Glue the seat",
      body: "Jointed edges, cauls, square the panel after it dries. Cut to the ticket rectangle. Shape only what the notes call for.",
      techniques: ["glue-up"],
    });
  }
  steps.push(
    {
      id: "sc3p",
      title: "Pocket the stretchers and dry-fit the box",
      body: "Two pockets on each stretcher end, inside face. Set the jig to actual stock thickness. Dry-fit the legs and stretchers. Diagonals at the floor and at the seat. Then glue.",
      techniques: ["pocket-hole", "clamp-up"],
      forRoutes: ["pocket"],
    },
    {
      id: "sc3m",
      title: "Mortise the legs, tenon the stretchers and rails",
      body: "Mortise first, tenon to fit. Dry-fit the two sides, then close the box. Shoulders land on the ticket length — do not invent extra stock.",
      techniques: ["mortise-tenon", "clamp-up"],
      forRoutes: ["mortise"],
    },
    {
      id: "sc4",
      title: "Set the seat",
      body: opts.upholstered
        ? "Plywood seat A lands on the front legs and between the back posts. Corner blocks at all four corners. Fit webbing, foam, and fabric after the frame is square. Check that the chair does not rock."
        : "Seat lands on the front legs and between the back posts. Corner blocks at all four corners, screwed into the seat and the legs. Check that the chair does not rock.",
      techniques: ["clamp-up"],
    },
  );
  if (opts.lattice) {
    steps.push({
      id: "sc5",
      title: "Fit the back rails, then the lattice",
      body: "Rails between the stiles. The opening is the lattice's job. Cut strips long, lay them on 45° so they make stacked diamonds, mark the half-laps where they cross, cut the laps, glue and pin in the opening. Trim flush after it dries.",
      techniques: ["square-cut", "half-lap"],
    });
  }
  if (opts.paint) {
    steps.push({
      id: "sc6",
      title: "Break edges, prime, paint",
      body: "Ease every edge you will touch. Sand 120-180. Prime. Two coats of enamel. Leave the underside unfinished if you want the wood to still breathe.",
      techniques: ["finish-paint"],
    });
  }
  return steps;
}

export type PhotoJoinery = {
  routes: ConstructionRoute[];
  hardware: HardwareItem[];
  steps: BuildStep[];
  defaultRoute: string;
  indoor: boolean;
};

export function compilePhotoJoinery(
  reading: PhotoReading,
  parts: Part[],
  opts: { nonWood?: boolean; suggestedRouteId?: string } = {},
): PhotoJoinery {
  const lattice = isLatticeTagged(reading);
  const paint = isPaintTagged(reading);
  const seat = parts.find((p) => p.role === "seat") ?? parts.find((p) => /\bseat\b/i.test(p.name));
  const seatKind = reading.seat ?? reading.drawing?.seatKind;
  const upholstered = seat
    ? isUpholsteredSeat(reading, seat, opts.nonWood === true)
    : false;
  const hasSolidSeat =
    Boolean(seat) && !upholstered && seatKind !== "unknown" && seat?.stock !== "plywood";
  const defaultRoute =
    opts.suggestedRouteId === "mortise" || opts.suggestedRouteId === "pocket"
      ? opts.suggestedRouteId
      : "pocket";
  const outdoor = /\b(outdoor|adirondack|garden|patio)\b/i.test(
    `${reading.name ?? ""} ${reading.interpretation ?? ""}`,
  );
  return {
    routes: PHOTO_ROUTES.map((r) => ({ ...r })),
    hardware: photoHardware({ lattice, paint, upholstered }),
    steps: photoSteps({ lattice, paint, upholstered, hasSolidSeat }),
    defaultRoute,
    indoor: !outdoor,
  };
}

/** Defense-in-depth for photo/URL packets if catalog plates ever get attached. */
export function stripCatalogPlates(
  project: {
    hardware: HardwareItem[];
    steps: BuildStep[];
  },
  reading: PhotoReading,
): { hardware: HardwareItem[]; steps: BuildStep[] } {
  const lattice = isLatticeTagged(reading);
  const paint = isPaintTagged(reading);
  let hardware = project.hardware;
  let steps = project.steps;
  if (!lattice) {
    hardware = hardware.filter((h) => h.id !== "pins-ch");
    steps = steps.filter((s) => s.id !== "sc5" && !s.techniques.includes("half-lap"));
  }
  if (!paint) {
    hardware = hardware.filter((h) => h.id !== "primer-ch");
    steps = steps.filter((s) => s.id !== "sc6" && !s.techniques.includes("finish-paint"));
  }
  return { hardware, steps };
}
