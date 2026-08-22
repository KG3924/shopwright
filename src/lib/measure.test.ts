import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCutAxis,
  formatCutTriplet,
  formatMeasured,
  hasSourcedDims,
  unknownDim,
} from "./measure";
import type { CutRow, PartMeasured } from "./types";

const sourced: PartMeasured = {
  length: { value: 48, source: "measured", confidence: 0.9 },
  width: { value: 14, source: "inferred", confidence: 0.5 },
  thickness: { value: null, source: "unknown", confidence: 0 },
};

describe("measure helpers", () => {
  it("requires two sourced axes", () => {
    assert.equal(hasSourcedDims(sourced), true);
    assert.equal(
      hasSourcedDims({
        ...sourced,
        width: unknownDim(),
      }),
      false,
    );
  });

  it("prints ? when value is null", () => {
    assert.equal(formatMeasured(sourced.thickness), "?");
    assert.equal(formatMeasured(sourced.length), `48"`);
    const cut = {
      length: 48,
      width: 14,
      thickness: 0.75,
      measured: sourced,
      locked: { length: false, width: false, thickness: false, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(formatCutAxis(cut, "thickness"), "?");
    assert.equal(formatCutTriplet(cut), `48" × 14" × ?`);
  });

  it("prints a locked override instead of ?", () => {
    const cut = {
      length: 48,
      width: 14,
      thickness: 0.875,
      measured: sourced,
      locked: { length: false, width: false, thickness: true, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(formatCutAxis(cut, "thickness"), `7/8"`);
  });
});
