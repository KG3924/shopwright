import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compilePacket } from "./compile";
import {
  cutHoldFromPacket,
  formatDoNotCut,
  holdWarningCount,
} from "./measure";
import {
  PACKET_COPY,
  UNEXPLAINED_JARGON_RE,
  formatHoldBody,
  packetChromeStrings,
} from "./plain-copy";
import { statusForRoute } from "./routes";
import { hydrateVision, parseVisionJson } from "./ai/hydrate";
import type { ConstructionRoute } from "./types";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "ai/fixtures");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function loadWeakScale() {
  return JSON.parse(
    readFileSync(join(fixtureDir, "weak-scale-missing-underside-fail.json"), "utf8"),
  ) as { ai: unknown };
}

describe("plain packet copy", () => {
  it("beginner chrome copy has no unexplained shop jargon", () => {
    for (const text of packetChromeStrings()) {
      assert.doesNotMatch(
        text,
        UNEXPLAINED_JARGON_RE,
        `jargon in chrome copy: ${text}`,
      );
    }
    assert.match(PACKET_COPY.tickets, /cross-bar under the seat \(stretcher\)/);
    assert.match(PACKET_COPY.homeLead, /One photo is enough/);
    assert.equal(formatHoldBody({ routeRunnable: false }).includes("rank"), false);
  });

  it("collapses a single-photo weak-scale packet to one Don't-cut BLUF", () => {
    const fixture = loadWeakScale();
    const project = hydrateVision(
      parseVisionJson(JSON.stringify(fixture.ai)),
      {
        kind: "photo",
        rank: "beginner",
        toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
      },
      [],
    );
    const packet = compilePacket(project, "75013");
    assert.equal(holdWarningCount(packet.warnings), 0);
    const hold = cutHoldFromPacket(packet);
    assert.ok(hold);
    assert.equal(hold.notes.length, 1);
    assert.match(hold.notes[0]!, /photo, not a tape/i);
    assert.match(hold.notes[0]!, /\?/);
    assert.doesNotMatch(hold.text, /sourced axis|stock template|scale confidence is low/i);
    assert.doesNotMatch(hold.text, /underside not visible/i);
  });

  it("does not dump scale notes into the hold", () => {
    const hold = formatDoNotCut({
      doNotCut: true,
      scaleConfidence: "low",
      unknownAxes: 1,
      scaleNotes: [
        "No tape or labeled dimension in frame.",
        "Underside not visible — seat thickness unknown.",
        "One board is missing a sourced axis — tickets will print ? until you measure it.",
      ],
    });
    assert.ok(hold);
    assert.equal(hold.notes.length, 1);
    assert.doesNotMatch(hold.text, /sourced axis/);
    assert.doesNotMatch(hold.text, /Underside not visible/);
  });

  it("parks rank in an advanced disclosure and does not require it on screen", () => {
    const studio = read("src/components/studio-view.tsx");
    assert.match(studio, /data-rank-advanced/);
    assert.match(studio, /<details className="mt-4" data-rank-advanced>/);
    assert.match(studio, /PACKET_COPY\.rankAdvanced/);
    assert.match(studio, /PACKET_COPY\.toolsTitle/);
    const rankBlock = studio.slice(
      studio.indexOf("data-rank-advanced"),
      studio.indexOf("data-rank-advanced") + 900,
    );
    assert.match(rankBlock, /RANKS\.map/);
    const toolsIdx = studio.indexOf("PACKET_COPY.toolsTitle");
    const rankIdx = studio.indexOf("data-rank-advanced");
    assert.ok(toolsIdx > 0 && rankIdx > toolsIdx, "tools come before parked rank");
    assert.doesNotMatch(studio, /RANK_META\[route\.recommendedRank\]/);
    assert.equal(
      [...studio.matchAll(/<DoNotCutCallout/g)].length,
      1,
      "studio screen should render one Don't-cut callout",
    );
    assert.doesNotMatch(studio, /\{DONT_CUT_YET\}/);
  });

  it("does not require rank to run a tools-gated mortise route", () => {
    const mortise: ConstructionRoute = {
      id: "mortise",
      name: "Mortise and tenon",
      recommendedRank: "apprentice",
      minRank: "apprentice",
      summary: "Haunched tenons.",
      joinery: "mortise and tenon",
      tools: ["mortiser"],
      tradeoffs: "",
      hiddenWork: "",
    };
    const beginner = statusForRoute(
      mortise,
      "beginner",
      ["mortiser", "chisels", "clamps"],
    );
    const craftsman = statusForRoute(
      mortise,
      "craftsman",
      ["mortiser", "chisels", "clamps"],
    );
    assert.equal(beginner.runnable, true);
    assert.equal(craftsman.runnable, true);
    assert.deepEqual(beginner.reasons, craftsman.reasons);
    const noTools = statusForRoute(mortise, "master", ["drill"]);
    assert.equal(noTools.runnable, false);
    assert.ok(noTools.reasons.some((r) => /Mortiser or Chisels/i.test(r)));
    assert.ok(!noTools.reasons.some((r) => /rank/i.test(r)));
  });
});
