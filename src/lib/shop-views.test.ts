import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { formatInches } from "./format";
import {
  assemblyStepsOpen,
  elevationCallout,
  elevationViewAxes,
  explodeOffset,
  formatElevationCallout,
  isoShowsBadge,
  isMajorShopPart,
  labelElevationParts,
  separateBadges,
  type ElevationRect,
} from "./shop-views";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function drawingsSource() {
  return readFileSync(join(root, "src/components/shop-drawings.tsx"), "utf8");
}

function rect(
  over: Partial<ElevationRect> & Pick<ElevationRect, "letter" | "role">,
): ElevationRect {
  return {
    x: 0,
    y: 0,
    w: 16,
    h: 14,
    depth: 0,
    unknownW: false,
    unknownH: false,
    ...over,
  };
}

describe("elevation callouts", () => {
  it("prints overall W/D/H with cut-list honesty — ? when unknown", () => {
    assert.equal(formatElevationCallout("W", 48), `W 48"`);
    assert.equal(formatElevationCallout("D", 14), `D 14"`);
    assert.equal(formatElevationCallout("H", 18), `H 18"`);
    assert.equal(formatElevationCallout("H", 17.25), `H 17-1/4"`);
    assert.equal(formatElevationCallout("H", null), "H ?");
    assert.equal(formatElevationCallout("W", undefined), "W ?");
    assert.equal(formatElevationCallout("D", Number.NaN), "D ?");
    assert.equal(formatElevationCallout("H", 0), "H ?");
    assert.equal(elevationCallout("W", 48).unknown, false);
    assert.equal(elevationCallout("H", null).unknown, true);
    assert.equal(elevationCallout("H", null).inches, "?");
    assert.doesNotMatch(formatElevationCallout("H", null), /0"|¾|3\/4/);
  });

  it("maps front / side / plan to the shop axes a novice reads", () => {
    assert.deepEqual(elevationViewAxes("front"), { xName: "W", yName: "H" });
    assert.deepEqual(elevationViewAxes("side"), { xName: "D", yName: "H" });
    assert.deepEqual(elevationViewAxes("plan"), { xName: "W", yName: "D" });
  });

  it("uses the same mixed-number inches as the cut list", () => {
    assert.equal(elevationCallout("W", 17.25).inches, formatInches(17.25));
    assert.equal(elevationCallout("D", 1.5).inches, `1-1/2"`);
  });
});

describe("elevation part labels", () => {
  it("prioritizes seat/top, legs, rails/stretchers — not every slat", () => {
    assert.equal(isMajorShopPart("seat"), true);
    assert.equal(isMajorShopPart("top"), true);
    assert.equal(isMajorShopPart("leg"), true);
    assert.equal(isMajorShopPart("rail"), true);
    assert.equal(isMajorShopPart("stretcher"), true);
    assert.equal(isMajorShopPart("apron-long"), true);
    assert.equal(isMajorShopPart("post"), true);
    assert.equal(isMajorShopPart("stile"), true);
    assert.equal(isMajorShopPart("side"), true);
    assert.equal(isMajorShopPart("back"), true);
    assert.equal(isMajorShopPart("arm"), true);
    assert.equal(isMajorShopPart("slat"), false);
    assert.equal(isMajorShopPart("cleat"), false);
    assert.equal(isMajorShopPart("other"), false);

    const labels = labelElevationParts([
      rect({ letter: "A", role: "seat", x: 1, y: 0, w: 16, h: 1, depth: 2 }),
      rect({ letter: "B", role: "leg", x: 0, y: 1, w: 1.5, h: 17, depth: 0 }),
      rect({ letter: "B", role: "leg", x: 14.5, y: 1, w: 1.5, h: 17, depth: 0 }),
      rect({ letter: "D", role: "stretcher", x: 1.5, y: 14, w: 13, h: 1.5, depth: 1 }),
      rect({ letter: "E", role: "slat", x: 3, y: 0, w: 1, h: 12, depth: 8 }),
      rect({ letter: "E", role: "slat", x: 6, y: 0, w: 1, h: 12, depth: 8 }),
      rect({ letter: "F", role: "cleat", x: 2, y: 10, w: 12, h: 0.75, depth: 7 }),
    ]);
    const letters = labels.map((l) => l.letter).sort();
    assert.deepEqual(letters, ["A", "B", "B", "D"]);
    assert.ok(labels.every((l) => l.letter !== "E" && l.letter !== "F"));
  });

  it("labels bookcase sides and a back — not every shelf", () => {
    const labels = labelElevationParts([
      rect({ letter: "A", role: "side", x: 0, y: 0, w: 0.75, h: 60 }),
      rect({ letter: "A", role: "side", x: 31.25, y: 0, w: 0.75, h: 60 }),
      rect({ letter: "B", role: "back", x: 0.75, y: 0, w: 30.5, h: 60, depth: 12 }),
      rect({ letter: "C", role: "shelf", x: 0.75, y: 20, w: 30.5, h: 0.75 }),
      rect({ letter: "C", role: "shelf", x: 0.75, y: 40, w: 30.5, h: 0.75 }),
      rect({ letter: "D", role: "top", x: 0, y: 0, w: 32, h: 12 }),
    ]);
    const letters = [...new Set(labels.map((l) => l.letter))].sort();
    assert.deepEqual(letters, ["A", "B", "D"]);
    assert.ok(labels.every((l) => l.letter !== "C"));
  });

  it("keeps a dashed unknown major part labeled — identity is not a size claim", () => {
    const labels = labelElevationParts([
      rect({
        letter: "A",
        role: "seat",
        unknownH: true,
        w: 16,
        h: 0,
      }),
    ]);
    assert.equal(labels.length, 1);
    assert.equal(labels[0]?.letter, "A");
  });

  it("collapses stacked copies of the same letter so two overlapping legs are not a stampede", () => {
    const labels = labelElevationParts([
      rect({ letter: "B", role: "leg", x: 0, y: 1, w: 1.5, h: 17, depth: 0 }),
      rect({ letter: "B", role: "leg", x: 0.1, y: 1.1, w: 1.5, h: 17, depth: 12 }),
    ]);
    assert.equal(labels.length, 1);
    assert.equal(labels[0]?.letter, "B");
  });

  it("puts letters beside thin legs, on the seat when there is room", () => {
    const labels = labelElevationParts([
      rect({ letter: "A", role: "seat", x: 0, y: 0, w: 16, h: 14 }),
      rect({ letter: "B", role: "leg", x: 0, y: 1, w: 1.5, h: 17 }),
    ]);
    const seat = labels.find((l) => l.letter === "A");
    const leg = labels.find((l) => l.letter === "B");
    assert.equal(seat?.beside, false);
    assert.equal(leg?.beside, true);
  });
});

describe("exploded assembly quiet defaults", () => {
  const overall = { w: 18, d: 16, h: 36 };

  it("gives beginner/novice more explode air than a craftsman", () => {
    const quiet = explodeOffset(overall, "beginner");
    const novice = explodeOffset(overall, "novice");
    const dense = explodeOffset(overall, "craftsman");
    assert.ok(quiet > dense);
    assert.equal(quiet, novice);
    assert.ok(quiet > Math.max(overall.w, overall.d, overall.h) * 0.2);
    assert.ok(dense >= Math.max(overall.w, overall.d, overall.h) * 0.2);
  });

  it("collapses assembly steps for a novice; advanced stays open", () => {
    assert.equal(assemblyStepsOpen("beginner"), false);
    assert.equal(assemblyStepsOpen("novice"), false);
    assert.equal(assemblyStepsOpen("apprentice"), true);
    assert.equal(assemblyStepsOpen("craftsman"), true);
    assert.equal(assemblyStepsOpen("master"), true);
  });

  it("hides slat badges on a beginner explode; keeps seat/leg identity", () => {
    assert.equal(isoShowsBadge("seat", "beginner"), true);
    assert.equal(isoShowsBadge("leg", "novice"), true);
    assert.equal(isoShowsBadge("slat", "beginner"), false);
    assert.equal(isoShowsBadge("cleat", "novice"), false);
    assert.equal(isoShowsBadge("slat", "craftsman"), true);
    assert.equal(isoShowsBadge("other", "master"), true);
  });

  it("pushes overlapping letter badges apart", () => {
    const apart = separateBadges(
      [
        { id: "a", letter: "A", x: 40, y: 40 },
        { id: "b", letter: "B", x: 41, y: 40 },
      ],
      12,
    );
    const d = Math.hypot(apart[0]!.x - apart[1]!.x, apart[0]!.y - apart[1]!.y);
    assert.ok(d + 1e-6 >= 12);
    assert.equal(apart[0]!.letter, "A");
    assert.equal(apart[1]!.letter, "B");
  });
});

describe("shop drawing wiring", () => {
  it("Sheet 1 elevations use honest callouts and major-part letters", () => {
    const src = drawingsSource();
    assert.match(src, /formatElevationCallout|elevationCallout/);
    assert.match(src, /elevationViewAxes/);
    assert.match(src, /labelElevationParts/);
    assert.match(src, /ProjectedView/);
    assert.doesNotMatch(
      src.slice(src.indexOf("function Frame"), src.indexOf("function fillFor")),
      /formatInches\(worldW\)/,
    );
  });

  it("Sheet 4 keeps the legend, discloses steps, and quiets the iso", () => {
    const src = drawingsSource();
    const sheet4 = src.slice(
      src.indexOf('title="Exploded assembly"'),
      src.indexOf('title="Part tickets"'),
    );
    assert.match(sheet4, /<Legend /);
    assert.match(src, /function Legend[\s\S]*formatCutTriplet/);
    assert.match(sheet4, /<AssemblyStepList /);
    assert.match(src, /assemblyStepsOpen/);
    assert.match(src, /<details/);
    assert.match(src, /explodeOffset/);
    assert.match(src, /separateBadges/);
    assert.match(src, /isoShowsBadge/);
  });
});
