import type { Dim, Overall, Part, PartOverride } from "./types";
import { boardFeet, round32 } from "./format";

export function resolveDim(dim: Dim, overall: Overall): number {
  if (dim.from === "fixed") return round32(dim.offset);
  return round32(overall[dim.from] + dim.offset);
}

export function resolvePart(
  part: Part,
  overall: Overall,
  override?: PartOverride,
): { length: number; width: number; thickness: number; qty: number } {
  return {
    length: override?.length ?? resolveDim(part.length, overall),
    width: override?.width ?? resolveDim(part.width, overall),
    thickness: override?.thickness ?? resolveDim(part.thickness, overall),
    qty: override?.qty ?? part.qty,
  };
}

export function partBoardFeet(
  part: Part,
  overall: Overall,
  override?: PartOverride,
): number {
  const d = resolvePart(part, overall, override);
  return boardFeet(d.length, d.width, d.thickness, d.qty);
}

const W = (offset = 0): Dim => ({ from: "w", offset });
const D = (offset = 0): Dim => ({ from: "d", offset });
const H = (offset = 0): Dim => ({ from: "h", offset });
const F = (value: number): Dim => ({ from: "fixed", offset: value });

export const dim = { W, D, H, F };

/** Infer which overall axes a freeform part should track when AI returns raw inches. */
export function inferDim(
  name: string,
  axis: "length" | "width" | "thickness",
  value: number,
  overall: Overall,
): Dim {
  const n = name.toLowerCase();
  const v = round32(value);
  const close = (target: number) => Math.abs(v - target) < 0.4;

  if (axis === "thickness") return F(v);

  if (axis === "length") {
    if (close(overall.w) || /top|shelf|apron long|rail long|stretcher long|seat/.test(n))
      return W(v - overall.w);
    if (close(overall.h) || /side|leg|stile/.test(n)) return H(v - overall.h);
    if (close(overall.d)) return D(v - overall.d);
  }

  if (axis === "width") {
    if (close(overall.d) || /top|shelf|side/.test(n)) return D(v - overall.d);
    if (/apron|rail|drawer front|kick/.test(n) && !close(overall.d)) return F(v);
  }

  return F(v);
}
