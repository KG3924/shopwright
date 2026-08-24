import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compilePacket } from "../compile";
import { drawingCaption, inferDrawing } from "../drawing";
import { explodeLetteredBlanks, layoutBoxes } from "../layout";
import { explodeOffset } from "../shop-views";
import {
  cutHoldFromPacket,
  editorAxisValue,
  formatCutAxisSource,
  formatCutTriplet,
  ticketUnknownAxes,
  ticketViewLabels,
} from "../measure";
import { holdWarningCount } from "../plain-copy";
import { NO_ROUTE_ID } from "../routes";
import { isRectilinearOutline, outlineFor, shapeNotRead } from "../silhouette";
import { figuresForStep } from "../technique-drawings";
import {
  hydrateVision,
  parseVisionJson,
  type InterpretInput,
} from "./hydrate";
import type { ShopPacket } from "../types";

const dir = dirname(fileURLToPath(import.meta.url));
const input: InterpretInput = {
  kind: "photo",
  rank: "beginner",
  toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
};

type FixtureExpect = {
  scaleConfidence: "high" | "low" | "conflict";
  doNotCut: boolean;
  partsFromPhotos: boolean;
  ticketUnknownAxes: number;
  cutTriplets: Record<string, string>;
  warningsInclude?: string[];
  dimSources?: Record<
    string,
    Partial<Record<"length" | "width" | "thickness", string>>
  >;
  cutHold?: string | null;
  cutHoldIncludes?: string[];
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

  if (expect.dimSources) {
    for (const [name, axes] of Object.entries(expect.dimSources)) {
      const cut = byName.get(name);
      assert.ok(cut, `missing cut ${name}`);
      for (const axis of ["length", "width", "thickness"] as const) {
        if (axes[axis]) {
          assert.equal(formatCutAxisSource(cut, axis), axes[axis]);
        }
      }
    }
  }

  const hold = cutHoldFromPacket(packet);
  if (expect.cutHold === null) {
    assert.equal(hold, null);
  }
  if (hold) {
    assert.equal(hold.notes.length, 1, "Don't-cut must be one BLUF, not a stack");
  }
  assert.equal(
    holdWarningCount(packet.warnings),
    0,
    `hold lectures must not stack in warnings: ${JSON.stringify(packet.warnings)}`,
  );
  for (const needle of expect.cutHoldIncludes ?? []) {
    assert.ok(hold, "expected don't-cut copy");
    assert.match(hold.text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
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
    assert.equal(editorAxisValue(seat, "thickness"), 0.75);
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
    assert.equal(editorAxisValue(seat, "thickness"), null);
    assert.equal(formatCutAxisSource(seat, "thickness"), "verify before cut");
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

describe("curved seat must not hydrate as a flat square slab", () => {
  it("curved-seat-leola: keeps saddle profile, non-rect side outline, Don't-cut", () => {
    const fixture = load("curved-seat-leola.json");
    const { project, packet } = assertShopTruth(fixture);

    const spec = inferDrawing(project);
    assert.equal(spec.seatProfile, "saddled");
    assert.notEqual(spec.seatProfile, "flat");
    assert.notEqual(spec.seatShape, "square");
    assert.equal(spec.seatFront, "waterfall");
    assert.match(drawingCaption(spec), /saddled/i);
    assert.doesNotMatch(drawingCaption(spec), /^[^·]*square seat/);

    const side = outlineFor("side", spec);
    assert.ok(side && side.length >= 6);
    assert.equal(isRectilinearOutline(side), false);
    const well = side.filter((p) => p.x >= 0.2 && p.x <= 0.55 && p.y > 0.35);
    const frontSeat = side.filter((p) => p.x < 0.2 && p.y > 0.35);
    assert.ok(well.length && frontSeat.length);
    assert.ok(
      Math.min(...well.map((p) => p.y)) < Math.max(...frontSeat.map((p) => p.y)) - 0.015,
      "saddled side elevation must keep a seat dip",
    );

    const seat = packet.cuts.find((c) => /seat/i.test(c.name))!;
    assert.match(seat.notes ?? "", /saddle/i);
    assert.equal(seat.measured?.thickness.source, "unknown");
    assert.equal(packet.doNotCut, true);

    const exploded = explodeLetteredBlanks(project.overall, packet.cuts, {
      explode: explodeOffset(project.overall),
      seatHeightRatio: spec.seatHeightRatio,
    });
    const tickets = packet.cuts.map((c) => c.letter);
    assert.equal(exploded.length, tickets.length);
    assert.deepEqual(
      exploded.map((b) => b.letter).sort(),
      [...tickets].sort(),
    );
  });
});

describe("material translation — metal folding stool", () => {
  it("metal-folding-stool: wood blanks, chair family, no steel gauge, no hinge on the cut list", () => {
    const fixture = load("metal-folding-stool.json");
    const { project, packet } = assertShopTruth(fixture);

    assert.equal(project.category, "chair");
    assert.equal(project.id, "chair-read");
    assert.notEqual(project.speciesId, "steel");
    assert.ok(project.parts.every((p) => p.stock !== "sheet"));
    assert.match(project.interpretation, /translated to wood build/i);
    assert.ok(project.uncertainties.some((u) => /translated to wood build/i.test(u)));
    assert.ok(!packet.cuts.some((c) => /hinge/i.test(c.name)));
    assert.ok(packet.cuts.some((c) => /x-brace/i.test(c.name)));

    const spec = inferDrawing(project);
    assert.equal(spec.family, "chair");
    assert.equal(spec.backStyle, "none");
    assert.equal(spec.seatShape, "round");

    const front = outlineFor("front", spec);
    const plan = outlineFor("plan", spec);
    const slash = (pts: { x: number; y: number }[] | undefined) => {
      if (!pts || pts.length < 2) return false;
      const closed = [...pts, pts[0]!];
      for (let i = 0; i < closed.length - 1; i++) {
        const a = closed[i]!;
        const b = closed[i + 1]!;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (
          len > 0.4 &&
          Math.abs(b.x - a.x) > 0.2 &&
          Math.abs(b.y - a.y) > 0.2 &&
          mx < 0.5 &&
          my < 0.55
        ) {
          return true;
        }
      }
      return false;
    };
    assert.equal(slash(front), false, "front must not keep a CAD slash across a leg");
    assert.equal(slash(plan), false, "plan must not keep a diagonal slash across the seat");
    assert.equal(front, undefined);
    assert.equal(shapeNotRead(spec), true);

    const seat = packet.cuts.find((c) => c.name === "Seat")!;
    assert.equal(seat.measured?.thickness.source, "unknown");
    assert.equal(seat.measured?.thickness.value, null);
    assert.notEqual(seat.measured?.thickness.value, 0.062);

    const exploded = explodeLetteredBlanks(project.overall, packet.cuts, {
      explode: explodeOffset(project.overall),
      seatHeightRatio: spec.seatHeightRatio,
    });
    const tickets = packet.cuts.map((c) => c.letter);
    assert.equal(exploded.length, tickets.length);
    assert.deepEqual(
      exploded.map((b) => b.letter).sort(),
      [...tickets].sort(),
    );
  });
});

const LATTICE_LEAK_RE =
  /lattice|half-?lap|fit the lattice|diamond pins?|23-ga|enamel|primer|paint-grade poplar|white enamel/i;

function packetStory(packet: ShopPacket): string {
  return [
    packet.route.id,
    packet.route.name,
    packet.route.summary,
    packet.route.joinery,
    packet.route.hiddenWork,
    packet.species.id,
    packet.species.name,
    ...packet.hardware.map((h) => `${h.id} ${h.name} ${h.spec} ${h.where ?? ""}`),
    ...packet.steps.map((s) => `${s.id} ${s.title} ${s.body} ${s.techniques.join(" ")}`),
    ...packet.techniques.map((t) => `${t.id} ${t.name} ${t.body}`),
    ...packet.stillBuy,
    ...packet.doNotBuy,
    ...packet.stack,
    ...packet.cuts.map((c) => `${c.letter} ${c.name} ${c.notes ?? ""} ${c.fromStock} ${c.stock}`),
    ...packet.warnings,
    ...packet.project.uncertainties,
    packet.project.interpretation,
  ].join("\n");
}

function assertNoLatticeImpersonation(packet: ShopPacket) {
  const story = packetStory(packet);
  assert.doesNotMatch(story, LATTICE_LEAK_RE, story);
  assert.ok(!packet.hardware.some((h) => h.id === "pins-ch" || h.id === "primer-ch"));
  assert.ok(!packet.steps.some((s) => s.id === "sc5" || s.id === "sc6"));
  assert.ok(!packet.steps.some((s) => s.techniques.includes("half-lap")));
  assert.ok(!packet.steps.some((s) => s.techniques.includes("finish-paint")));
  for (const step of packet.steps) {
    assert.ok(!figuresForStep(step.techniques).includes("half-lap"));
    assert.ok(!figuresForStep(step.techniques).includes("finish-paint"));
  }
}

describe("packet-from-photo — Barros must not impersonate the catalog lattice chair", () => {
  const pocketInput: InterpretInput = {
    kind: "photo",
    rank: "beginner",
    toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
  };

  function compileBarros(over: Partial<InterpretInput> = {}) {
    const fixture = load("barros-side-chair.json");
    const ai = parseVisionJson(JSON.stringify(fixture.ai));
    assert.equal(ai.templateId, "side-chair");
    assert.equal(ai.drawing?.backStyle, "solid");
    const project = hydrateVision(ai, { ...pocketInput, ...over }, []);
    const packet = compilePacket(project, "75013");
    return { fixture, project, packet };
  }

  it("barros-side-chair: compile from this interpret only — no catalog lattice, paint, or poplar enamel", () => {
    const fixture = load("barros-side-chair.json");
    const { project, packet } = assertShopTruth(fixture);

    assert.equal(project.sourceKind, "photo");
    assert.equal(project.partsFromPhotos, true);
    assert.notEqual(project.id, "side-chair");
    assert.ok(!project.image?.includes("lattice-chair"));
    assert.equal(project.drawing?.backStyle, "solid");
    assert.notEqual(project.drawing?.backStyle, "lattice");
    assert.notEqual(project.speciesId, "poplar");
    assert.equal(project.speciesId, "maple");

    assertNoLatticeImpersonation(packet);
    assert.equal(packet.route.id, "pocket");

    const seat = packet.cuts.find((c) => c.letter === "A" || c.role === "seat")!;
    assert.equal(seat.letter, "A");
    assert.equal(seat.role, "seat");
    assert.equal(formatCutTriplet(seat), `18" × 16-1/2" × 3/4"`);
    assert.equal(seat.stock, "plywood");
    assert.doesNotMatch(seat.notes ?? "", /45\s*°|diamond|lattice|enamel|primer/i);
    assert.match(seat.notes ?? "", /fabric|webbing|plywood/i);
    assert.ok(
      packet.hardware.some((h) => /fabric|webbing|foam|upholster/i.test(`${h.id} ${h.name} ${h.spec}`)),
      "upholstered seat needs a fabric/webbing/foam pack",
    );
    assert.ok(!packet.steps.some((s) => s.techniques.includes("glue-up")));

    const spec = inferDrawing(project);
    assert.equal(spec.backStyle, "solid");
    const plan = outlineFor("plan", spec);
    assert.ok(plan && plan.length >= 4);
    assert.equal(isRectilinearOutline(plan), true, "seat A plan must stay the ticket rectangle");
  });

  it("barros-side-chair No-route still must not print lattice, enamel, or a Paint-A figure", () => {
    const { packet } = compileBarros({ toolsAvailable: [] });
    assert.equal(packet.route.id, NO_ROUTE_ID);
    assert.equal(packet.routeRunnable, false);
    assertNoLatticeImpersonation(packet);
  });

  it("does not use a parts-name blacklist as the lattice gate", () => {
    const src = readFileSync(join(dir, "photo-joinery.ts"), "utf8");
    assert.match(src, /backStyle/);
    assert.doesNotMatch(
      src,
      /parts\.some\([^)]*lattice/,
      "lattice gate must be interpret backStyle / explicit tag, not a parts-name check",
    );
  });
});
