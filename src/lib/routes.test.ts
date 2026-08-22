import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compilePacket } from "./compile";
import { offeredAndHidden } from "./routes";
import {
  hydrateVision,
  parseVisionJson,
  type InterpretInput,
} from "./ai/hydrate";
import type { Rank, ShopPacket, ShopTool } from "./types";

const dir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(dir, "ai/fixtures");

type RouteFixture = {
  id: string;
  base: string;
  input: {
    rank: Rank;
    toolsAvailable: ShopTool[];
    routeId: string;
  };
  expect: {
    routeId: string;
    routeName?: string;
    routeRunnable?: boolean;
    doNotCut?: boolean;
    routesOffered: string[];
    routesHidden: string[];
    hardwareIdsInclude: string[];
    hardwareIdsExclude: string[];
    hardwareWhereRequired?: string[];
    stepIdsInclude: string[];
    stepIdsExclude: string[];
    cutNotesInclude?: Record<string, string | null>;
    doNotInventAdvanced?: boolean;
    mustNotPresentAsMortise?: boolean;
    packetMustDifferFrom?: string;
  };
};

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8"));
}

function loadRoute(name: string): RouteFixture {
  return readJson(name) as RouteFixture;
}

function loadBaseAi(base: string): unknown {
  const file = base.endsWith(".json") ? base : `${base}.json`;
  return (readJson(file) as { ai: unknown }).ai;
}

function compileFixture(fixture: RouteFixture): ShopPacket {
  const ai = parseVisionJson(JSON.stringify(loadBaseAi(fixture.base)));
  const input: InterpretInput = {
    kind: "photo",
    rank: fixture.input.rank,
    toolsAvailable: fixture.input.toolsAvailable,
  };
  const project = hydrateVision(ai, input, []);
  project.routeId = fixture.input.routeId;
  project.rank = fixture.input.rank;
  project.toolsAvailable = fixture.input.toolsAvailable;
  return compilePacket(project, "75013");
}

function assertIdSet(
  actual: string[],
  include: string[],
  exclude: string[],
  label: string,
) {
  for (const id of include) {
    assert.ok(actual.includes(id), `missing ${label} ${id}: ${actual}`);
  }
  for (const id of exclude) {
    assert.ok(!actual.includes(id), `unexpected ${label} ${id}`);
  }
}

function assertRouteFixture(fixture: RouteFixture): ShopPacket {
  const packet = compileFixture(fixture);
  const { expect } = fixture;

  assert.equal(packet.route.id, expect.routeId);
  if (expect.routeName) assert.equal(packet.route.name, expect.routeName);
  if (expect.routeRunnable != null) {
    assert.equal(packet.routeRunnable, expect.routeRunnable);
  }
  if (expect.doNotCut != null) assert.equal(packet.doNotCut, expect.doNotCut);
  assert.deepEqual(packet.routesOffered, expect.routesOffered);
  assert.deepEqual(packet.routesHidden, expect.routesHidden);

  const hardwareIds = packet.hardware.map((h) => h.id);
  assertIdSet(
    hardwareIds,
    expect.hardwareIdsInclude,
    expect.hardwareIdsExclude,
    "hardware",
  );

  for (const id of expect.hardwareWhereRequired ?? []) {
    const item = packet.hardware.find((h) => h.id === id);
    assert.ok(item, `missing hardware ${id} for where`);
    assert.ok(
      (item.where ?? "").trim().length > 0,
      `${id} must carry a where`,
    );
  }

  const stepIds = packet.steps.map((s) => s.id);
  assertIdSet(stepIds, expect.stepIdsInclude, expect.stepIdsExclude, "step");

  for (const [name, needle] of Object.entries(expect.cutNotesInclude ?? {})) {
    const cut = packet.cuts.find((c) => c.name === name);
    assert.ok(cut, `missing cut ${name}`);
    if (needle == null || !cut.notes) continue;
    assert.match(cut.notes, new RegExp(needle, "i"));
  }

  if (expect.doNotInventAdvanced) {
    assert.ok(!stepIds.includes("sc3m"));
    assert.ok(!packet.routesOffered.includes("mortise"));
    assert.ok(packet.routesHidden.includes("mortise"));
  }

  if (expect.mustNotPresentAsMortise) {
    assertPacketNotMortise(packet);
  }

  return packet;
}

function assertPacketNotMortise(packet: ShopPacket) {
  assert.notEqual(packet.route.id, "mortise");
  assert.doesNotMatch(packet.route.name, /mortise/i);
  assert.doesNotMatch(packet.route.joinery, /mortise|m&t|tenon/i);
  assert.ok(!packet.routeRunnable);
  assert.ok(packet.doNotCut);
  assert.ok(!packet.steps.some((s) => s.id === "sc3m"));
  assert.ok(!packet.hardware.some((h) => h.id === "kreg-chair"));
  assert.ok(!packet.routesOffered.includes("mortise"));
}

function idSetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

describe("stool construction routes", () => {
  it("stool-route-pocket: hardware and step ids, pocket offered, mortise hidden", () => {
    const pocket = assertRouteFixture(loadRoute("stool-route-pocket.json"));
    assert.ok(pocket.routeRunnable);
    assert.ok(!pocket.steps.some((s) => s.id === "sc3m"));
  });

  it("stool-route-mortise: hardware and step ids, mortise offered, pocket hidden", () => {
    const mortise = assertRouteFixture(loadRoute("stool-route-mortise.json"));
    assert.ok(mortise.routeRunnable);
    assert.ok(!mortise.hardware.some((h) => h.id === "kreg-chair"));
    assert.ok(!mortise.steps.some((s) => s.id === "sc3p"));
  });

  it("pocket vs mortise hardware ids and step ids must differ", () => {
    const pocketFx = loadRoute("stool-route-pocket.json");
    const mortiseFx = loadRoute("stool-route-mortise.json");
    const pocket = compileFixture(pocketFx);
    const mortise = compileFixture(mortiseFx);

    assert.equal(mortiseFx.expect.packetMustDifferFrom, pocketFx.id);
    const pocketHw = pocket.hardware.map((h) => h.id);
    const mortiseHw = mortise.hardware.map((h) => h.id);
    const pocketSteps = pocket.steps.map((s) => s.id);
    const mortiseSteps = mortise.steps.map((s) => s.id);
    assert.equal(idSetEqual(pocketHw, mortiseHw), false);
    assert.equal(idSetEqual(pocketSteps, mortiseSteps), false);
    assert.ok(pocketHw.includes("kreg-chair"));
    assert.ok(!mortiseHw.includes("kreg-chair"));
    assert.ok(pocketSteps.includes("sc3p"));
    assert.ok(!pocketSteps.includes("sc3m"));
    assert.ok(mortiseSteps.includes("sc3m"));
    assert.ok(!mortiseSteps.includes("sc3p"));
  });

  it("stool-route-refuse: beginner + mortise without M&T tools is not a mortise packet", () => {
    const refused = assertRouteFixture(loadRoute("stool-route-refuse.json"));
    assert.equal(refused.route.id, "none");
    assert.equal(refused.route.name, "No route");
    assert.equal(refused.routeRunnable, false);
    assert.equal(refused.doNotCut, true);
    assertPacketNotMortise(refused);
  });

  it("beginner + empty tools never auto-compiles mortise", () => {
    const ai = parseVisionJson(JSON.stringify(loadBaseAi("tape-stool-pass")));
    const project = hydrateVision(
      ai,
      { kind: "photo", rank: "beginner", toolsAvailable: [] },
      [],
    );
    project.rank = "beginner";
    project.toolsAvailable = [];
    const packet = compilePacket(project, "75013");
    const offered = offeredAndHidden(packet.routeStatuses);

    assert.ok(!offered.routesOffered.includes("mortise"));
    assert.ok(!packet.steps.some((s) => s.id === "sc3m"));
    assert.ok(!packet.hardware.some((h) => h.id === "kreg-chair"));
    assert.equal(packet.routeRunnable, false);
    assertPacketNotMortise(packet);

    const promoted = compilePacket(
      { ...project, rank: "craftsman", routeId: "mortise", toolsAvailable: [] },
      "75013",
    );
    assert.ok(!promoted.routesOffered.includes("mortise"));
    assert.ok(!promoted.steps.some((s) => s.id === "sc3m"));
    assert.equal(promoted.routeRunnable, false);
    assertPacketNotMortise(promoted);
  });

  it("beginner + mortise without mortiser/chisels refuses or steers; never emits sc3m", () => {
    const ai = parseVisionJson(JSON.stringify(loadBaseAi("tape-stool-pass")));
    const project = hydrateVision(
      ai,
      { kind: "photo", rank: "beginner", toolsAvailable: [] },
      [],
    );
    project.rank = "beginner";
    project.routeId = "mortise";
    project.toolsAvailable = ["drill", "miter-saw", "clamps"];

    const refused = compilePacket(project, "75013");
    assert.ok(!refused.steps.some((s) => s.id === "sc3m"));
    assert.ok(
      !refused.routeRunnable || refused.route.id === "pocket",
      "must refuse or steer off mortise",
    );
    assertPacketNotMortise(refused);

    const steered = compilePacket(
      { ...project, toolsAvailable: ["kreg-jig", "drill", "clamps"] },
      "75013",
    );
    assert.equal(steered.route.id, "pocket");
    assert.ok(steered.steps.some((s) => s.id === "sc3p"));
    assert.ok(!steered.steps.some((s) => s.id === "sc3m"));
  });
});
