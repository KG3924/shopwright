import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asSeatProfile,
  hasShapedForm,
  honestOutline,
  isRectilinearOutline,
  outlineFor,
  recoverFormLanguage,
  sanitizeOutline,
  shapeNotRead,
} from "./silhouette";

/** A CAD-style diagonal cutting the lower-left of a front elevation. */
const DIAGONAL_SLASH = [
  { x: 0.02, y: 0 },
  { x: 0.14, y: 0.04 },
  { x: 0.58, y: 0.52 },
  { x: 0.08, y: 0.06 },
];

const SADDLED_SIDE = [
  { x: 0.1, y: 0 },
  { x: 0.12, y: 0.5 },
  { x: 0.04, y: 0.54 },
  { x: 0.22, y: 0.5 },
  { x: 0.45, y: 0.48 },
  { x: 0.7, y: 0.55 },
  { x: 0.8, y: 0.72 },
  { x: 0.86, y: 0.72 },
  { x: 0.78, y: 0.08 },
  { x: 0.7, y: 0 },
];

function seatDip(pts: { x: number; y: number }[]): number {
  const front = pts.filter((p) => p.x < 0.2 && p.y > 0.35);
  const well = pts.filter((p) => p.x >= 0.2 && p.x <= 0.55 && p.y > 0.35);
  const frontY = Math.max(...front.map((p) => p.y));
  const wellY = Math.min(...well.map((p) => p.y));
  return frontY - wellY;
}

function slashCutsLowerLeft(pts: { x: number; y: number }[] | undefined): boolean {
  if (!pts || pts.length < 2) return false;
  const closed = [...pts, pts[0]!];
  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i]!;
    const b = closed[i + 1]!;
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (len > 0.4 && dx > 0.2 && dy > 0.2 && mx < 0.5 && my < 0.55) return true;
  }
  return false;
}

describe("seat form aliases", () => {
  it("maps saddle / contoured onto the shop enum", () => {
    assert.equal(asSeatProfile("saddle"), "saddled");
    assert.equal(asSeatProfile("saddled"), "saddled");
    assert.equal(asSeatProfile("contoured"), "sculpted");
    assert.equal(asSeatProfile("flat"), "flat");
    assert.equal(asSeatProfile("not-a-profile"), undefined);
  });
});

describe("rectilinear outlines", () => {
  it("detects a 4-corner box and not a saddle polyline", () => {
    assert.equal(
      isRectilinearOutline([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
      true,
    );
    assert.equal(isRectilinearOutline(SADDLED_SIDE), false);
  });
});

describe("junk / CAD polylines", () => {
  it("rejects a diagonal-slash polyline instead of drawing it", () => {
    assert.equal(honestOutline(DIAGONAL_SLASH), undefined);
    assert.equal(sanitizeOutline(DIAGONAL_SLASH.map((p) => [p.x, p.y])), undefined);
    const drawn = outlineFor("front", {
      family: "chair",
      backStyle: "none",
      frontOutline: DIAGONAL_SLASH,
    });
    assert.equal(slashCutsLowerLeft(drawn), false);
    assert.notEqual(drawn, DIAGONAL_SLASH);
  });

  it("rejects 4-point garbage that is not a filled silhouette", () => {
    const bowtie = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    assert.equal(honestOutline(bowtie), undefined);
  });

  it("rejects a lightning-bolt slash that cuts through air", () => {
    const bolt = [
      { x: 0.08, y: 0 },
      { x: 0.18, y: 0.12 },
      { x: 0.62, y: 0.58 },
      { x: 0.2, y: 0.18 },
      { x: 0.75, y: 0.88 },
      { x: 0.12, y: 0.08 },
    ];
    assert.equal(honestOutline(bolt), undefined);
    assert.equal(
      outlineFor("front", { family: "chair", backStyle: "none", frontOutline: bolt }),
      undefined,
    );
  });

  it("rejects a camera-wing spike to a corner", () => {
    const wing = [
      { x: 0, y: 0 },
      { x: 0.28, y: 0.42 },
      { x: 0.72, y: 0.42 },
      { x: 0.72, y: 0.82 },
      { x: 0.28, y: 0.82 },
    ];
    assert.equal(honestOutline(wing), undefined);
  });

  it("does not treat a slash as a shaped form worth overlaying", () => {
    assert.equal(
      hasShapedForm({
        family: "chair",
        frontOutline: DIAGONAL_SLASH,
      }),
      false,
    );
  });

  it("metal / CAD junk falls back to blanks and shape-not-read, not a cartoon overlay", () => {
    const spec = {
      family: "chair" as const,
      backStyle: "none" as const,
      seatShape: "round" as const,
      preferConstructedOutline: true,
      frontOutline: DIAGONAL_SLASH,
    };
    assert.equal(outlineFor("front", spec), undefined);
    assert.equal(outlineFor("side", spec), undefined);
    assert.equal(shapeNotRead(spec), true);
  });
});

describe("recoverFormLanguage", () => {
  it("lifts a saddle named in prose", () => {
    const form = recoverFormLanguage(
      "Leola low-back side chair. Saddled seat, waterfall front, tapered splay legs.",
    );
    assert.equal(form.seatProfile, "saddled");
    assert.equal(form.seatFront, "waterfall");
    assert.equal(form.legStyle, "tapered-splay");
  });

  it("does not invent a saddle on a square-seat stool", () => {
    const form = recoverFormLanguage("Square-seat stool; tape on seat front edge.");
    assert.equal(form.seatProfile, undefined);
  });
});

describe("outlineFor", () => {
  it("replaces a box side outline when the seat is saddled", () => {
    const spec = {
      family: "chair" as const,
      seatProfile: "saddled" as const,
      seatShape: "square" as const,
      seatHeightRatio: 0.55,
      sideOutline: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    };
    assert.equal(hasShapedForm(spec), true);
    const side = outlineFor("side", spec);
    assert.ok(side);
    assert.equal(isRectilinearOutline(side), false);
    const ys = side.map((p) => p.y);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 0.3);
    assert.ok(seatDip(side) > 0.02, "saddled side must show a seat dip");
  });

  it("keeps a valid saddled outline and still shows a dip on the side elevation", () => {
    const spec = {
      family: "chair" as const,
      seatProfile: "saddled" as const,
      seatFront: "waterfall" as const,
      backStyle: "solid" as const,
      seatHeightRatio: 0.55,
      sideOutline: SADDLED_SIDE,
    };
    const kept = honestOutline(SADDLED_SIDE);
    assert.ok(kept && kept.length >= 6);
    const side = outlineFor("side", spec);
    assert.ok(side && side.length >= 6);
    assert.equal(isRectilinearOutline(side), false);
    assert.ok(seatDip(side) > 0.02);
    assert.ok(Math.max(...side.map((p) => p.y)) < 0.92, "low-back must not stretch to full height");
  });

  it("does not invent a backrest on a backless stool", () => {
    const sh = 0.95;
    const front = outlineFor("front", {
      family: "chair",
      backStyle: "none",
      seatShape: "round",
      seatProfile: "flat",
      seatHeightRatio: sh,
    });
    if (front) {
      assert.ok(Math.max(...front.map((p) => p.y)) <= sh + 0.04);
      assert.equal(slashCutsLowerLeft(front), false);
    }
  });
});
