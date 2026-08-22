import { formatDimTriplet, formatInches } from "./format";
import type { BuyBoard, CutRow, Project, Stock } from "./types";

export function oneByLabel(width: number): string {
  if (width <= 1.6) return "1×2";
  if (width <= 2.6) return "1×3";
  if (width <= 3.6) return "1×4";
  if (width <= 5.75) return "1×6";
  if (width <= 7.5) return "1×8";
  if (width <= 9.5) return "1×10";
  return "1×12";
}

export function inferFromStock(
  stock: Stock,
  thickness: number,
  width: number,
): string {
  if (stock === "sheet") return "PETG / sheet goods";
  if (stock === "dowel") return "dowel stock";
  if (stock === "plywood" || stock === "hardwood-ply") {
    const t =
      thickness <= 0.3 ? "¼\"" : thickness <= 0.6 ? "½\"" : "¾\"";
    return `${t} plywood`;
  }
  if (Math.abs(width - thickness) < 0.35 && width >= 1.2) {
    return `${formatInches(width)} square · mill or glue-up`;
  }
  return oneByLabel(Math.max(width, thickness));
}

function nominalWidthInches(label: string): number {
  const m = label.match(/1×(\d+)/);
  if (m) return Number(m[1]);
  if (/square/.test(label)) return 2;
  return 4;
}

function groupKey(c: CutRow): string {
  if (c.fromStock && !c.fromStock.startsWith("1×") && c.stock !== "solid") {
    return c.fromStock;
  }
  return inferFromStock(c.stock, c.thickness, c.width);
}

export function inferBoards(cuts: CutRow[]): BuyBoard[] {
  const groups = new Map<
    string,
    { stock: string; parts: CutRow[]; linear: number; area: number }
  >();
  for (const c of cuts) {
    if (c.stock === "sheet") continue;
    const key = groupKey(c);
    const g = groups.get(key) ?? {
      stock: key,
      parts: [],
      linear: 0,
      area: 0,
    };
    g.parts.push(c);
    g.linear += (c.length + 0.25) * c.qty;
    g.area += c.length * c.width * c.qty;
    groups.set(key, g);
  }

  const boards: BuyBoard[] = [];
  let n = 1;
  for (const g of groups.values()) {
    const letters = g.parts
      .map((p) => `${p.letter} ${p.name}`)
      .join(" · ");
    if (/plywood/i.test(g.stock)) {
      const sheetArea = 24 * 48;
      const sheets = Math.max(1, Math.ceil(g.area / sheetArea));
      boards.push({
        id: `sheet-${n}`,
        label: sheets === 1 ? "SHEET 1" : `SHEET ${n}`,
        stock: `${g.stock} · ${sheets === 1 ? "24×48 project panel" : `${sheets} × 24×48`}`,
        bdft: Math.round((g.area / 144) * 10) / 10,
        role: "SHEET GOODS",
        yields: letters,
        body: `Cut ${g.parts.map((p) => `${p.qty}× ${p.name}`).join(", ")} from this panel. A 24×24 will not fit triangles plus a soffit — buy the 2×4 ft panel.`,
      });
      n += 1;
      continue;
    }
    const count = Math.max(1, Math.ceil(g.linear / 72));
    const nomW = nominalWidthInches(g.stock);
    const bdft = Math.round(((nomW / 12) * 6 * count) * 10) / 10;
    const stockLabel =
      count === 1 ? `${g.stock} × 6'` : `${count} pcs ${g.stock} × 6'`;
    boards.push({
      id: `board-${n}`,
      label: `BOARD ${n}`,
      stock: stockLabel,
      bdft,
      role: n === 1 ? "BEST / FLATTEST" : "STOCK",
      yields: letters,
      body: `From this: ${g.parts
        .map(
          (p) =>
            `${p.qty}× ${p.name} at ${formatDimTriplet(p.length, p.width, p.thickness)}`,
        )
        .join(". ")}. Leftover is spare — don't cut it until the listed parts are done.`,
    });
    n += 1;
  }
  return boards;
}

export function compileYield(
  project: Project,
  cuts: CutRow[],
): {
  boards: BuyBoard[];
  stillBuy: string[];
  doNotBuy: string[];
  stack: string[];
} {
  const boards = project.buyBoards?.length
    ? project.buyBoards
    : inferBoards(cuts);
  const stillBuy = project.stillBuy?.length
    ? project.stillBuy
    : inferStillBuy(cuts);
  const doNotBuy = project.doNotBuy ?? [];
  const stack = project.stack?.length
    ? project.stack
    : [
        `Overall ${formatInches(project.overall.w)} W × ${formatInches(project.overall.d)} D × ${formatInches(project.overall.h)} H`,
        ...cuts
          .slice(0, 8)
          .map(
            (c) =>
              `${c.letter} ${c.name}: ${c.qty}× ${formatDimTriplet(c.length, c.width, c.thickness)}`,
          ),
      ];
  return { boards, stillBuy, doNotBuy, stack };
}

function inferStillBuy(cuts: CutRow[]): string[] {
  const extra: string[] = [];
  if (cuts.some((c) => c.stock === "sheet")) {
    extra.push("PETG sheet — not acrylic. Acrylic cracks on the table saw.");
  }
  if (cuts.some((c) => c.stock === "plywood" || c.stock === "hardwood-ply")) {
    extra.push("Confirm plywood is the 24×48 (or 4×8) size the nesting needs.");
  }
  extra.push("Glue, finish, and every fastener on the Hardware tab.");
  return extra;
}

export function nextLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return `P${index + 1}`;
}
