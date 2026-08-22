import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compilePacket } from "./compile";
import {
  STOCK_THICKNESS_INCHES,
  formatCutAxis,
  formatCutAxisSource,
  offersStockThicknessPick,
} from "./measure";
import type { CutRow } from "./types";
import { inferFill, type InferCandidate } from "./ai/infer";
import { hydrateVision, type AiJson, type InterpretInput } from "./ai/hydrate";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const tools: InterpretInput = {
  kind: "photo",
  rank: "beginner",
  toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
};

function chairWithUnknownSeatThickness(): AiJson {
  return {
    name: "Dining side chair",
    category: "chair",
    templateId: "side-chair",
    interpretation: "Upright dining chair. Overall labeled on the box.",
    confidence: 0.82,
    overall: { w: 18, d: 18, h: 36 },
    overallSource: "labeled",
    scaleConfidence: "high",
    parts: [
      {
        name: "Seat",
        qty: 1,
        role: "seat",
        length: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
        width: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
        thickness: {
          value: null,
          source: "unknown",
          confidence: 0,
          note: "underside not visible",
        },
      },
      {
        name: "Front left leg",
        qty: 1,
        role: "leg",
        length: { value: 17.25, source: "measured", confidence: 0.9, photoIndex: 1 },
        width: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 1 },
        thickness: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 1 },
      },
      {
        name: "Front right leg",
        qty: 1,
        role: "leg",
        length: { value: 17.25, source: "measured", confidence: 0.9, photoIndex: 1 },
        width: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 1 },
        thickness: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 1 },
      },
    ],
  };
}

function unknownCut(): Pick<CutRow, "measured" | "locked"> {
  return {
    measured: {
      length: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
      width: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
      thickness: { value: null, source: "unknown", confidence: 0 },
    },
    locked: { length: false, width: false, thickness: false, qty: false },
  };
}

describe("stock thickness picker", () => {
  it("offers ½″, ¾″, and 1″ — never a silent ¾ default", () => {
    assert.deepEqual([...STOCK_THICKNESS_INCHES], [0.5, 0.75, 1]);
  });

  it("offers the picker only on unknown unlocked thickness", () => {
    const unknown = unknownCut();
    assert.equal(offersStockThicknessPick(unknown), true);

    assert.equal(
      offersStockThicknessPick({
        ...unknown,
        locked: { length: false, width: false, thickness: true, qty: false },
      }),
      false,
    );

    assert.equal(
      offersStockThicknessPick({
        measured: {
          length: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
          width: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
          thickness: { value: 0.75, source: "inferred", confidence: 0.4 },
        },
        locked: { length: false, width: false, thickness: false, qty: false },
      }),
      false,
    );

    assert.equal(
      offersStockThicknessPick({
        locked: { length: false, width: false, thickness: false, qty: false },
      }),
      false,
    );
  });

  it("keeps unknown thickness as ? after hydrate/infer — no auto 0.75, no override", () => {
    const project = hydrateVision(chairWithUnknownSeatThickness(), tools, []);
    const packet = compilePacket(project, "75013");
    const seat = packet.cuts.find((c) => c.name === "Seat")!;

    assert.equal(formatCutAxis(seat, "thickness"), "?");
    assert.equal(seat.measured?.thickness.source, "unknown");
    assert.equal(seat.measured?.thickness.value, null);
    assert.notEqual(seat.measured?.thickness.value, 0.75);
    assert.equal(project.partOverrides?.[seat.id]?.thickness, undefined);
    assert.equal(seat.locked.thickness, false);
    assert.equal(offersStockThicknessPick(seat), true);
    assert.equal(packet.doNotCut, true);
  });

  it("does not invent 0.75 stock thickness on infer-fill", () => {
    const parts: InferCandidate[] = [
      {
        name: "Seat",
        role: "seat",
        qty: 1,
        measured: {
          length: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
          width: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
          thickness: { value: null, source: "unknown", confidence: 0 },
        },
      },
      {
        name: "Leg",
        role: "leg",
        qty: 4,
        measured: {
          length: { value: 17.25, source: "measured", confidence: 0.9, photoIndex: 0 },
          width: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 0 },
          thickness: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 0 },
        },
      },
    ];
    const seat = inferFill(parts, {
      overall: { w: 18, d: 18, h: 36 },
      overallSource: "labeled",
      scaleConfidence: "high",
      name: "Dining side chair",
      category: "chair",
    })[0]!;
    assert.equal(seat.measured.thickness.source, "unknown");
    assert.equal(seat.measured.thickness.value, null);
    assert.notEqual(seat.measured.thickness.value, 0.75);
  });

  it("picking ¾ locks the axis as builder override and never marks it measured", () => {
    const project = hydrateVision(chairWithUnknownSeatThickness(), tools, []);
    const before = compilePacket(project, "75013");
    const seat = before.cuts.find((c) => c.name === "Seat")!;
    assert.equal(formatCutAxis(seat, "thickness"), "?");
    assert.equal(offersStockThicknessPick(seat), true);

    const picked = STOCK_THICKNESS_INCHES[1];
    assert.equal(picked, 0.75);
    project.partOverrides = { [seat.id]: { thickness: picked } };

    const locked = compilePacket(project, "75013");
    const lockedSeat = locked.cuts.find((c) => c.name === "Seat")!;
    assert.equal(lockedSeat.locked.thickness, true);
    assert.equal(formatCutAxis(lockedSeat, "thickness"), `3/4"`);
    assert.equal(formatCutAxisSource(lockedSeat, "thickness"), "locked — your tape");
    assert.equal(lockedSeat.measured?.thickness.source, "unknown");
    assert.equal(lockedSeat.measured?.thickness.value, null);
    assert.notEqual(lockedSeat.measured?.thickness.source, "measured");
    assert.doesNotMatch(formatCutAxisSource(lockedSeat, "thickness"), /measured from photo/);
    assert.equal(offersStockThicknessPick(lockedSeat), false);
  });

  it("clears Don't-cut when unknown thickness was the last hold and the builder picks stock", () => {
    const project = hydrateVision(chairWithUnknownSeatThickness(), tools, []);
    const held = compilePacket(project, "75013");
    const seat = held.cuts.find((c) => c.name === "Seat")!;
    assert.equal(held.doNotCut, true);
    assert.equal(formatCutAxis(seat, "thickness"), "?");
    assert.ok(
      held.cuts.every(
        (c) =>
          c.name === "Seat" ||
          (!c.locked.thickness &&
            c.measured?.length.source === "measured" &&
            c.measured.width.source === "measured" &&
            c.measured.thickness.source === "measured"),
      ),
    );

    project.partOverrides = { [seat.id]: { thickness: 0.75 } };
    const confirmed = compilePacket(project, "75013");
    const lockedSeat = confirmed.cuts.find((c) => c.name === "Seat")!;
    assert.equal(formatCutAxis(lockedSeat, "thickness"), `3/4"`);
    assert.equal(formatCutAxisSource(lockedSeat, "thickness"), "locked — your tape");
    assert.equal(confirmed.doNotCut, false);
    assert.ok(confirmed.routeRunnable);
  });

  it("wires common-stock picks on the thickness InchField, not a parallel lock path", () => {
    const field = read("src/components/inch-field.tsx");
    const studio = read("src/components/studio-view.tsx");
    assert.match(field, /picks/);
    assert.match(field, /onCommit\(n\)/);
    assert.match(studio, /STOCK_THICKNESS_INCHES/);
    assert.match(studio, /label="Thickness"/);
    const thicknessBlock = studio.slice(studio.indexOf('label="Thickness"'));
    assert.match(thicknessBlock, /picks=\{STOCK_THICKNESS_INCHES\}/);
    assert.match(thicknessBlock, /setPartOverride\(c\.id, \{ thickness: n \}\)/);
    assert.doesNotMatch(studio, /source:\s*"measured"/);
  });
});
