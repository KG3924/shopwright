import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compilePacket } from "../compile";
import { inferDrawing } from "../drawing";
import { layoutBoxes } from "../layout";
import {
  formatCutTriplet,
  ticketUnknownAxes,
  ticketViewLabels,
} from "../measure";
import {
  hydrateVision,
  parseVisionJson,
  type InterpretInput,
} from "./hydrate";

const dir = dirname(fileURLToPath(import.meta.url));
const input: InterpretInput = { kind: "photo", rank: "beginner" };

type FixtureExpect = {
  scaleConfidence: "high" | "low" | "conflict";
  doNotCut: boolean;
  partsFromPhotos: boolean;
  ticketUnknownAxes: number;
  cutTriplets: Record<string, string>;
  warningsInclude?: string[];
};

type Fixture = {
  id: string;
  expect: FixtureExpect;
  ai: unknown;
};

function load(name: string): Fixture {
  return JSON.parse(readFileSync(join(dir, "fixtures", name), "utf8")) as Fixture;
}

function run(fixture: Fixture) {
  const ai = parseVisionJson(JSON.stringify(fixture.ai));
  const project = hydrateVision(ai, input, []);
  const packet = compilePacket(project, "75013");
  return { ai, project, packet };
}

const TEMPLATE_STOCK_IDS = new Set(["top", "apron-l", "apron-s", "seat", "leg"]);

function assertShopTruth(fixture: Fixture) {
  const { project, packet } = run(fixture);
  const { expect } = fixture;

  assert.equal(project.scaleConfidence, expect.scaleConfidence);
  assert.equal(project.partsFromPhotos, true);
  assert.equal(packet.project.partsFromPhotos, true);
  assert.equal(packet.doNotCut, expect.doNotCut);
  assert.equal(ticketUnknownAxes(packet.cuts), expect.ticketUnknownAxes);

  assert.ok(project.id.endsWith("-read"));
  assert.ok(project.parts.every((p) => p.id.startsWith("p")));
  assert.ok(packet.cuts.every((c) => c.id.startsWith("p")));
  assert.ok(!packet.cuts.some((c) => TEMPLATE_STOCK_IDS.has(c.id)));

  const byName = new Map(packet.cuts.map((c) => [c.name, c]));
  for (const [name, triplet] of Object.entries(expect.cutTriplets)) {
    const cut = byName.get(name);
    assert.ok(cut, `missing cut ${name}`);
    assert.equal(formatCutTriplet(cut), triplet);
  }

  for (const needle of expect.warningsInclude ?? []) {
    assert.ok(
      packet.warnings.some((w) => w.toLowerCase().includes(needle.toLowerCase())),
      `expected a warning including ${JSON.stringify(needle)}, got ${JSON.stringify(packet.warnings)}`,
    );
  }

  return { project, packet };
}

describe("accuracy Cut B fixtures", () => {
  it("tape-stool-pass: measured tape reading compiles a cut-ready packet", () => {
    const fixture = load("tape-stool-pass.json");
    const { project, packet } = assertShopTruth(fixture);

    const spec = inferDrawing(project);
    assert.equal(spec.backStyle, "none");
    assert.notEqual(spec.seatHeightRatio, 0.61);
    assert.ok(!packet.warnings.some((w) => /do not cut yet/i.test(w)));

    const seat = packet.cuts.find((c) => c.name === "Seat")!;
    const edge = ticketViewLabels(seat, "edge");
    assert.equal(edge.y, `3/4"`);
    assert.equal(edge.unknownY, false);
    assert.ok(!/measure first/i.test(seat.fromStock));
  });

  it("weak-scale-missing-underside-fail: unknown thickness stays ? and is not a stock fill", () => {
    const fixture = load("weak-scale-missing-underside-fail.json");
    const { project, packet } = assertShopTruth(fixture);

    assert.equal(project.partsFromPhotos, true);
    const spec = inferDrawing(project);
    assert.equal(spec.family, "chair");
    assert.equal(spec.backStyle, "none");
    assert.notEqual(spec.backStyle, "lattice");
    assert.notEqual(spec.seatHeightRatio, 0.61);

    const seat = packet.cuts.find((c) => c.name === "Seat")!;
    assert.equal(seat.measured?.thickness.source, "unknown");
    assert.equal(seat.measured?.thickness.value, null);
    assert.notEqual(seat.thickness, 0.75);
    assert.ok(/measure first/i.test(seat.fromStock));
    assert.ok(!/1×12|¾"|3\/4/.test(seat.fromStock));

    const edge = ticketViewLabels(seat, "edge");
    const end = ticketViewLabels(seat, "end");
    assert.equal(edge.y, "?");
    assert.equal(end.y, "?");
    assert.equal(edge.unknownY, true);
    assert.equal(end.unknownY, true);

    const boxes = layoutBoxes(project.overall, packet.cuts, {
      seatHeightRatio: spec.seatHeightRatio,
    });
    const seatBox = boxes.find((b) => b.name === "Seat");
    assert.ok(seatBox);
    assert.equal(seatBox.unknown?.h, true);
    assert.notEqual(seatBox.h, 0.75);
  });
});
