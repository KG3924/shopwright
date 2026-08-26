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
  HOLD_BODY,
  PACKET_COPY,
  SHOP_PLAIN,
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
    assert.match(PACKET_COPY.homeCatalogBlurb, /example packet/i);
    assert.match(PACKET_COPY.homeCatalogBlurb, /not the photo product path/i);
    assert.match(PACKET_COPY.homeCatalogTitle, /example packet/i);
    assert.match(PACKET_COPY.homeLead, /cannot authorize a cut list/);
    assert.match(PACKET_COPY.buildLead, /match the tickets/);
    assert.doesNotMatch(PACKET_COPY.homeLead, /\?/);
    assert.doesNotMatch(PACKET_COPY.drawingsFromPhotos, /\?/);
    assert.equal(formatHoldBody({ routeRunnable: false }).includes("rank"), false);
  });

  it("uses scout beginner names, not unexplained shop jargon", () => {
    assert.equal(SHOP_PLAIN.crest, "top bar of the chair back");
    assert.equal(SHOP_PLAIN.stretcher, "lower support connecting the legs");
    assert.equal(SHOP_PLAIN.stile, "vertical side of a door or frame");
    assert.equal(SHOP_PLAIN.rabbet, "step-shaped cut along the edge");
    assert.equal(SHOP_PLAIN.rail, "horizontal piece of a frame");
    assert.equal(SHOP_PLAIN.apron, "frame under the tabletop, between the legs");
    assert.equal(SHOP_PLAIN.mortiseTenon, "tongue and the pocket it fits into");
    assert.equal(SHOP_PLAIN.dado, "three-sided trench for a shelf");
    assert.equal(SHOP_PLAIN.kerf, "slot the blade removes");
    assert.equal("haunch" in SHOP_PLAIN, false);
    assert.equal(Object.keys(HOLD_BODY).length, 4);
    const drawings = read("src/components/chair-drawings.tsx");
    assert.match(drawings, /SHOP_PLAIN\.stile/);
    assert.match(drawings, /SHOP_PLAIN\.rail/);
    assert.doesNotMatch(drawings, /G \+ H rails · C stiles/);
    const feeder = read("src/components/shop-drawings.tsx");
    assert.match(feeder, /SHOP_PLAIN\.kerf/);
    assert.doesNotMatch(feeder, /⅛" kerf/);
    for (const body of Object.values(HOLD_BODY)) {
      assert.doesNotMatch(body, /\?/);
      assert.doesNotMatch(body, /lattice|mortise|rank/i);
    }
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
    assert.equal(hold.notes[0], HOLD_BODY.photo);
    assert.doesNotMatch(hold.text, /\?/);
    assert.doesNotMatch(hold.text, /sourced axis|stock template|scale confidence is low/i);
    assert.doesNotMatch(hold.text, /underside not visible/i);
  });

  it("stays silent about ? when tickets already print it", () => {
    const photo = formatDoNotCut({
      doNotCut: true,
      scaleConfidence: "low",
      unknownAxes: 3,
    });
    assert.ok(photo);
    assert.equal(photo.notes[0], HOLD_BODY.photo);
    assert.doesNotMatch(photo.text, /\?/);
    const lock = formatDoNotCut({
      doNotCut: true,
      scaleConfidence: "high",
      unknownAxes: 1,
    });
    assert.ok(lock);
    assert.equal(lock.notes[0], HOLD_BODY.lock);
    assert.doesNotMatch(lock.text, /\?/);
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
    assert.match(studio, /data-build-steps/);
    assert.match(studio, /TechniqueFigures/);
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
