import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asSeatProfile,
  hasShapedForm,
  isRectilinearOutline,
  outlineFor,
  recoverFormLanguage,
} from "./silhouette";

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
    assert.equal(
      isRectilinearOutline([
        { x: 0.1, y: 0 },
        { x: 0.12, y: 0.5 },
        { x: 0.04, y: 0.54 },
        { x: 0.42, y: 0.48 },
        { x: 0.7, y: 0.55 },
        { x: 0.8, y: 0.9 },
        { x: 0.7, y: 0 },
      ]),
      false,
    );
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
  });
});
