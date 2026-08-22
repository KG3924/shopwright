import type { LumberSource } from "./types";

/** v0.1: Allen / North Dallas plus Prairieville / Gonzales. Other ZIPs fall back to national big-box. */
export const SOURCES: LumberSource[] = [
  {
    id: "hd-allen",
    name: "Home Depot Allen",
    kind: "big-box",
    city: "Allen, TX",
    miles: 2,
    carries: "Dimensional SYP, red oak 1×, cedar, construction plywood, Kreg, screws",
    note: "Walk the racks. Skip bowed 2×. Oak 1× is the realistic 'buy today' hardwood.",
    regions: ["75002", "75013", "75023", "75025", "75070", "75069", "dfw"],
  },
  {
    id: "lowes-allen",
    name: "Lowe's Allen",
    kind: "big-box",
    city: "Allen, TX",
    miles: 3,
    carries: "SYP, cedar, poplar, sheet goods, Titebond, stainless deck screws",
    note: "Often better cedar and poplar selection than Depot. Check the back of the 1× rack.",
    regions: ["75002", "75013", "75023", "75025", "75070", "dfw"],
  },
  {
    id: "woodcraft-plano",
    name: "Woodcraft Plano",
    kind: "specialty",
    city: "Plano, TX",
    miles: 12,
    carries: "Hardwood boards, Kreg, Blum slides, finishes, hand tools, Dominos (kit)",
    note: "Pay more, waste less. Good for hardware you don't want to order and wait on.",
    regions: ["75002", "75013", "75023", "75025", "75093", "75024", "dfw"],
  },
  {
    id: "rockler-richardson",
    name: "Rockler Richardson",
    kind: "specialty",
    city: "Richardson, TX",
    miles: 16,
    carries: "Slides, hinges, walnut/maple offcuts, finishes, jigs",
    note: "Best local stop for drawer slides and decent small hardwood pieces.",
    regions: ["75002", "75013", "75080", "75081", "75082", "dfw"],
  },
  {
    id: "austin-hardwoods",
    name: "Austin Hardwoods Dallas",
    kind: "hardwood",
    city: "Dallas, TX",
    miles: 28,
    carries: "Walnut, maple, white oak, plywood, 4/4–8/4 S2S and S4S",
    note: "This is where the walnut and quarter-sawn oak actually live. Bring a tape and a list.",
    regions: ["75002", "75013", "dfw"],
  },
  {
    id: "houston-hardwoods",
    name: "Houston Hardwoods (Dallas)",
    kind: "hardwood",
    city: "Dallas, TX",
    miles: 32,
    carries: "Domestic + imported hardwoods, sheet goods, millwork",
    note: "Call ahead for walnut 5/4 and white oak. Worth the drive for a furniture run.",
    regions: ["75002", "75013", "dfw"],
  },
  {
    id: "hd-gonzales",
    name: "Home Depot Gonzales",
    kind: "big-box",
    city: "Gonzales, LA",
    miles: 4,
    carries:
      "Dimensional lumber, cedar, ½\" project panels, stainless screws, Titebond III, floor flanges, Penofin",
    note: "2740 S Cajun Ave · (225) 644-5670. Buy the 24×48 × ½\" panel, not 24×24. Stainless, glue, flange, oil.",
    regions: [
      "70769",
      "70737",
      "70734",
      "70726",
      "70809",
      "70810",
      "70816",
      "70817",
      "br",
    ],
  },
  {
    id: "lowes-gonzales",
    name: "Lowe's Gonzales",
    kind: "big-box",
    city: "Gonzales, LA",
    miles: 6,
    carries:
      "Cedar, poplar, sheet goods, copper roll flashing, stainless, Titebond",
    note: "12484 Airline Hwy · (225) 644-0929. Copper flashing 8\"×20' lives here. Backup for HD on screws, flange, oil.",
    regions: [
      "70769",
      "70737",
      "70734",
      "70726",
      "70809",
      "70810",
      "70816",
      "70817",
      "br",
    ],
  },
  {
    id: "hd-national",
    name: "Home Depot (local)",
    kind: "big-box",
    city: "Near you",
    miles: 5,
    carries: "Dimensional lumber, red oak, pine, plywood, fasteners",
    note: "Use for pine, plywood, and hardware. Don't expect furniture-grade walnut.",
    regions: ["us"],
  },
  {
    id: "lowes-national",
    name: "Lowe's (local)",
    kind: "big-box",
    city: "Near you",
    miles: 5,
    carries: "Dimensional lumber, poplar, cedar, fasteners, glue",
    note: "Same as Depot — good for the buy list, not for a walnut top.",
    regions: ["us"],
  },
];

export function sourcesForZip(zip: string): LumberSource[] {
  const z = zip.trim();
  const dfw = /^(75|76)\d{3}$/.test(z);
  const br = /^(707|708)\d{2}$/.test(z);
  const local = SOURCES.filter(
    (s) =>
      s.regions.includes(z) ||
      (dfw && s.regions.includes("dfw")) ||
      (br && s.regions.includes("br")),
  );
  if (local.length) {
    return local.sort((a, b) => a.miles - b.miles);
  }
  return SOURCES.filter((s) => s.regions.includes("us"));
}

export function defaultZip(): string {
  return "75013";
}
