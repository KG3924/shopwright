import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compilePacket } from "./compile";
import { formatCutTriplet } from "./measure";
import {
  MORTISE_CUT_NOTE,
  POCKET_CUT_NOTE,
  resolveConstructionRoute,
} from "./routes";
import {
  hydrateVision,
  parseVisionJson,
  type InterpretInput,
} from "./ai/hydrate";
import type { Rank, ShopTool } from "./types";

const dir = dirname(fileURLToPath(import.meta.url));

type RouteFixture = {
  id: string;
  rank: Rank;
  routeId: string;
  toolsAvailable: ShopTool[];
  expect: {
    routeRunnable: boolean;
    hardwareIds: string[];
    absentHardwareIds: string[];
    stepIds: string[];
    absentStepIds: string[];
    cutTriplets: Record<string, string>;
    cutNotesInclude: Record<string, string>;
    cutNotesExclude: Record<string, string>;
    kregWhereIncludes?: string[];
  };
  ai: unknown;
};

function loadRoute(name: string): RouteFixture {
  return JSON.parse(
    readFileSync(join(dir, "ai/fixtures", name), "utf8"),
  ) as RouteFixture;
}

function compileFixture(fixture: RouteFixture) {
  const ai = parseVisionJson(JSON.stringify(fixture.ai));
  const input: InterpretInput = {
    kind: "photo",
    rank: fixture.rank,
    toolsAvailable: fixture.toolsAvailable,
  };
  const project = hydrateVision(ai, input, []);
  project.routeId = fixture.routeId;
  project.rank = fixture.rank;
  project.toolsAvailable = fixture.toolsAvailable;
  return compilePacket(project, "75013");
}

function assertRouteFixture(fixture: RouteFixture) {
  const packet = compileFixture(fixture);
  const { expect } = fixture;

  assert.equal(packet.routeRunnable, expect.routeRunnable);
  assert.equal(packet.route.id, fixture.routeId);

  const hardwareIds = packet.hardware.map((h) => h.id);
  for (const id of expect.hardwareIds) {
    assert.ok(hardwareIds.includes(id), `missing hardware ${id}: ${hardwareIds}`);
  }
  for (const id of expect.absentHardwareIds) {
    assert.ok(!hardwareIds.includes(id), `unexpected hardware ${id}`);
  }

  const stepIds = packet.steps.map((s) => s.id);
  for (const id of expect.stepIds) {
    assert.ok(stepIds.includes(id), `missing step ${id}: ${stepIds}`);
  }
  for (const id of expect.absentStepIds) {
    assert.ok(!stepIds.includes(id), `unexpected step ${id}`);
  }

  const byName = new Map(packet.cuts.map((c) => [c.name, c]));
  for (const [name, triplet] of Object.entries(expect.cutTriplets)) {
    const cut = byName.get(name);
    assert.ok(cut, `missing cut ${name}`);
    assert.equal(formatCutTriplet(cut), triplet);
  }

  for (const [name, needle] of Object.entries(expect.cutNotesInclude)) {
    const cut = byName.get(name);
    assert.ok(cut, `missing cut ${name}`);
    assert.match(
      cut.notes ?? "",
      new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
  }
  for (const [name, needle] of Object.entries(expect.cutNotesExclude)) {
    const cut = byName.get(name);
    assert.ok(cut, `missing cut ${name}`);
    assert.doesNotMatch(
      cut.notes ?? "",
      new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
  }

  if (expect.kregWhereIncludes) {
    const kreg = packet.hardware.find((h) => h.id === "kreg-chair");
    assert.ok(kreg, "missing Kreg fasteners");
    assert.match(kreg.spec, /1¼"|1 1\/4"|1-1\/4"/);
    assert.match(kreg.spec, /#8/);
    for (const needle of expect.kregWhereIncludes) {
      assert.match(kreg.where ?? "", new RegExp(needle, "i"));
    }
  }

  return packet;
}

describe("stool construction routes", () => {
  it("stool-route-pocket: Kreg hardware, pocket steps, no tenon notes", () => {
    const pocket = assertRouteFixture(loadRoute("stool-route-pocket.json"));
    assert.ok(pocket.steps.every((s) => s.id !== "sc3m"));
    assert.ok(!pocket.hardware.some((h) => /mortise/i.test(h.id)));
  });

  it("stool-route-mortise: no pocket screws, mortise steps, tenon notes on listed length", () => {
    const mortise = assertRouteFixture(loadRoute("stool-route-mortise.json"));
    assert.ok(!mortise.hardware.some((h) => h.id === "kreg-chair"));
    assert.ok(mortise.hardware.some((h) => h.id === "glue-ch"));
    assert.ok(mortise.hardware.some((h) => h.id === "corner-blocks"));
    const leg = mortise.cuts.find((c) => c.name === "Leg")!;
    assert.equal(leg.length, 17.25);
    assert.equal(leg.width, 1.5);
    assert.equal(leg.thickness, 1.5);
    assert.ok(leg.notes?.includes("Tenon shoulders"));
    assert.ok(!/¾|3\/4/.test(leg.notes ?? "") || /do not invent extra stock/i.test(leg.notes ?? ""));
  });

  it("switching pocket ↔ mortise changes hardware ids, step ids, and cut notes", () => {
    const pocket = compileFixture(loadRoute("stool-route-pocket.json"));
    const mortise = compileFixture(loadRoute("stool-route-mortise.json"));

    const pocketHw = new Set(pocket.hardware.map((h) => h.id));
    const mortiseHw = new Set(mortise.hardware.map((h) => h.id));
    assert.ok(
      [...pocketHw].some((id) => !mortiseHw.has(id)) ||
        [...mortiseHw].some((id) => !pocketHw.has(id)),
      "hardware ids must change across routes",
    );
    assert.ok(pocketHw.has("kreg-chair"));
    assert.ok(!mortiseHw.has("kreg-chair"));

    const pocketSteps = new Set(pocket.steps.map((s) => s.id));
    const mortiseSteps = new Set(mortise.steps.map((s) => s.id));
    assert.ok(pocketSteps.has("sc3p"));
    assert.ok(!pocketSteps.has("sc3m"));
    assert.ok(mortiseSteps.has("sc3m"));
    assert.ok(!mortiseSteps.has("sc3p"));

    const pocketLeg = pocket.cuts.find((c) => c.name === "Leg")!.notes ?? "";
    const mortiseLeg = mortise.cuts.find((c) => c.name === "Leg")!.notes ?? "";
    assert.notEqual(pocketLeg, mortiseLeg);
    assert.ok(pocketLeg.includes(POCKET_CUT_NOTE) || /do not invent tenon length/i.test(pocketLeg));
    assert.ok(mortiseLeg.includes(MORTISE_CUT_NOTE) || /tenon shoulders/i.test(mortiseLeg));
  });

  it("empty tools + rank switch does not invent a mortise packet", () => {
    const ai = parseVisionJson(
      JSON.stringify(loadRoute("stool-route-mortise.json").ai),
    );
    const beginner = hydrateVision(
      ai,
      { kind: "photo", rank: "beginner", toolsAvailable: [] },
      [],
    );
    beginner.routeId = "pocket";
    beginner.toolsAvailable = [];
    const beginnerPacket = compilePacket(beginner, "75013");

    const craftsman = {
      ...beginner,
      rank: "craftsman" as const,
      routeId: "mortise",
      toolsAvailable: [] as ShopTool[],
    };
    const craftsmanPacket = compilePacket(craftsman, "75013");

    assert.equal(beginnerPacket.routeRunnable, false);
    assert.equal(craftsmanPacket.routeRunnable, false);
    assert.ok(!craftsmanPacket.hardware.some((h) => h.id === "kreg-chair"));
    assert.ok(!craftsmanPacket.steps.some((s) => s.id === "sc3m"));
    assert.ok(!craftsmanPacket.steps.some((s) => s.id === "sc3p"));
    const leg = craftsmanPacket.cuts.find((c) => c.name === "Leg");
    assert.ok(leg);
    assert.doesNotMatch(leg.notes ?? "", /tenon shoulders/i);
    assert.ok(
      craftsmanPacket.warnings.some((w) => /will not invent joinery/i.test(w)),
    );
  });

  it("beginner + mortise without M&T tools steers to pocket or refuses", () => {
    const ai = parseVisionJson(
      JSON.stringify(loadRoute("stool-route-mortise.json").ai),
    );
    const bare = hydrateVision(
      ai,
      { kind: "photo", rank: "beginner", toolsAvailable: [] },
      [],
    );
    bare.routeId = "mortise";
    bare.rank = "beginner";
    bare.toolsAvailable = [];
    const refused = compilePacket(bare, "75013");
    assert.equal(refused.routeRunnable, false);
    assert.ok(!refused.steps.some((s) => s.id === "sc3m"));
    assert.ok(!refused.hardware.some((h) => h.id === "kreg-chair"));

    const withKreg = {
      ...bare,
      toolsAvailable: ["kreg"] as ShopTool[],
    };
    const steered = compilePacket(withKreg, "75013");
    const resolved = resolveConstructionRoute(withKreg);
    assert.equal(resolved.steered, true);
    assert.equal(resolved.route.id, "pocket");
    assert.equal(steered.route.id, "pocket");
    assert.ok(steered.steps.some((s) => s.id === "sc3p"));
    assert.ok(!steered.steps.some((s) => s.id === "sc3m"));
    assert.ok(steered.warnings.some((w) => /cannot run/i.test(w)));

    const mortiserOnly = {
      ...bare,
      toolsAvailable: ["mortiser"] as ShopTool[],
    };
    const stillRefused = compilePacket(mortiserOnly, "75013");
    assert.equal(stillRefused.routeRunnable, false);
    assert.ok(!stillRefused.steps.some((s) => s.id === "sc3m"));
    assert.ok(
      stillRefused.warnings.some((w) => /apprentice|chisels \/ mortiser|cannot run/i.test(w)),
    );
  });
});
