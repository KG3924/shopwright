import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compilePhotoJoinery,
  isLatticeTagged,
  isPaintTagged,
  isUpholsteredSeat,
  photoSpeciesId,
} from "./photo-joinery";
import type { Part } from "../types";

const seat: Part = {
  id: "p0",
  name: "Seat",
  qty: 1,
  length: { from: "fixed", offset: 18 },
  width: { from: "fixed", offset: 16 },
  thickness: { from: "fixed", offset: 0.75 },
  stock: "solid",
  grain: "length",
  role: "seat",
};

describe("photo joinery lattice gate", () => {
  it("tags lattice only when drawing.backStyle is lattice", () => {
    assert.equal(isLatticeTagged({ drawing: { family: "chair", backStyle: "lattice" } }), true);
    assert.equal(
      isLatticeTagged({
        drawing: { family: "chair" },
        visibleDetails: ["lattice back, eight strips"],
      }),
      false,
    );
    assert.equal(isLatticeTagged({ drawing: { family: "chair", backStyle: "unknown" } }), false);
    assert.equal(isLatticeTagged({ drawing: { family: "chair", backStyle: "crest" } }), false);
  });

  it("splat, solid, crest, none, and unknown are not lattice — even with a lattice-named part", () => {
    for (const backStyle of ["splat", "solid", "crest", "none", "unknown", "x-back", "slat-fan"] as const) {
      assert.equal(
        isLatticeTagged({
          drawing: { family: "chair", backStyle },
          visibleDetails: ["solid crest"],
          parts: [{ name: "Lattice strip", role: "slat" }],
        }),
        false,
        backStyle,
      );
    }
  });

  it("does not treat template-shaped interpretation as a lattice tag when backStyle is solid", () => {
    assert.equal(
      isLatticeTagged({
        drawing: { family: "chair", backStyle: "solid" },
        interpretation: "Looks like the studio lattice-back chair, but this one has a solid crest.",
      }),
      false,
    );
  });
});

describe("photo joinery finish and seat", () => {
  it("unknown / natural hardwood is not catalog enamel", () => {
    assert.equal(
      isPaintTagged({
        interpretation: "Natural hardwood dining chair",
        visibleDetails: ["natural hardwood finish"],
      }),
      false,
    );
    assert.equal(isPaintTagged({ finish: "unknown" }), false);
    assert.equal(isPaintTagged({ finish: "clear" }), false);
    assert.equal(isPaintTagged({ finish: "paint" }), true);
    assert.equal(photoSpeciesId(undefined), "maple");
    assert.notEqual(photoSpeciesId(undefined), "poplar");
  });

  it("seat field: upholstered packs, solid may glue, unknown does neither", () => {
    const upholstered = compilePhotoJoinery(
      { seat: "upholstered", finish: "unknown", drawing: { family: "chair", backStyle: "crest" } },
      [seat],
    );
    assert.ok(upholstered.hardware.some((h) => h.id === "upholstery-pack"));
    assert.ok(!upholstered.steps.some((s) => s.techniques.includes("glue-up")));
    assert.ok(!upholstered.steps.some((s) => s.id === "sc5" || s.id === "sc6"));

    const unknown = compilePhotoJoinery(
      { seat: "unknown", finish: "unknown", drawing: { family: "chair", backStyle: "unknown" } },
      [seat],
    );
    assert.ok(!unknown.hardware.some((h) => h.id === "upholstery-pack"));
    assert.ok(!unknown.steps.some((s) => s.techniques.includes("glue-up")));
    assert.ok(!unknown.hardware.some((h) => h.id === "pins-ch" || h.id === "primer-ch"));
  });

  it("upholstered fabric seat is not a solid glue-up", () => {
    assert.equal(
      isUpholsteredSeat(
        {
          interpretation: "Upholstered fabric seat, solid crest",
          visibleDetails: ["upholstered fabric seat"],
        },
        { name: "Seat", role: "seat", notes: "Upholstered fabric over the seat." },
      ),
      true,
    );
    const joinery = compilePhotoJoinery(
      {
        interpretation: "Upholstered fabric seat",
        visibleDetails: ["upholstered fabric seat"],
        drawing: { family: "chair", backStyle: "solid" },
      },
      [seat],
    );
    assert.ok(joinery.hardware.some((h) => h.id === "upholstery-pack"));
    assert.ok(!joinery.steps.some((s) => s.techniques.includes("glue-up")));
    assert.ok(!joinery.steps.some((s) => s.id === "sc5" || s.id === "sc6"));
    assert.ok(!joinery.hardware.some((h) => h.id === "pins-ch" || h.id === "primer-ch"));
  });

  it("lattice-tagged interpret still compiles lattice hardware and the half-lap step", () => {
    const joinery = compilePhotoJoinery(
      { drawing: { family: "chair", backStyle: "lattice" } },
      [seat],
    );
    assert.ok(joinery.hardware.some((h) => h.id === "pins-ch"));
    assert.ok(joinery.steps.some((s) => s.id === "sc5" && s.techniques.includes("half-lap")));
  });
});
