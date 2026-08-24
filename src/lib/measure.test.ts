import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DONT_CUT_YET,
  editorAxisValue,
  formatCutAxis,
  formatCutAxisSource,
  formatCutSources,
  formatCutTriplet,
  formatDimSource,
  formatDoNotCut,
  formatMeasured,
  hasSourcedDims,
  ticketUnknownAxes,
  ticketViewLabels,
  unknownDim,
  isCutAxisUnconfirmed,
} from "./measure";
import { HOLD_BODY } from "./plain-copy";
import { formatInches } from "./format";
import type { CutRow, PartMeasured } from "./types";

const sourced: PartMeasured = {
  length: { value: 48, source: "measured", confidence: 0.9 },
  width: { value: 14, source: "inferred", confidence: 0.5 },
  thickness: { value: null, source: "unknown", confidence: 0 },
};

describe("measure helpers", () => {
  it("requires two sourced axes", () => {
    assert.equal(hasSourcedDims(sourced), true);
    assert.equal(
      hasSourcedDims({
        ...sourced,
        width: unknownDim(),
      }),
      false,
    );
  });

  it("prints ? when value is null", () => {
    assert.equal(formatMeasured(sourced.thickness), "?");
    assert.equal(formatMeasured(sourced.length), `48"`);
    const cut = {
      length: 48,
      width: 14,
      thickness: 0.75,
      measured: sourced,
      locked: { length: false, width: false, thickness: false, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(formatCutAxis(cut, "thickness"), "?");
    assert.equal(formatCutTriplet(cut), `48" × 14" × ?`);
  });

  it("counts unknown ticket axes and binds ticket views to MeasuredDim", () => {
    const cut = {
      length: 16,
      width: 16,
      thickness: 0.75,
      measured: sourced,
      locked: { length: false, width: false, thickness: false, qty: false },
    } as Pick<
      CutRow,
      "length" | "width" | "thickness" | "measured" | "locked"
    >;
    assert.equal(ticketUnknownAxes([cut]), 1);
    const edge = ticketViewLabels(cut, "edge");
    assert.equal(edge.y, "?");
    assert.equal(edge.unknownY, true);
  });

  it("prints shop mixed numbers with a hyphen", () => {
    assert.equal(formatInches(17.25), `17-1/4"`);
    assert.equal(formatInches(1.5), `1-1/2"`);
    assert.equal(formatInches(0.75), `3/4"`);
  });

  it("treats unlocked inferred as unconfirmed and a lock as confirmed", () => {
    const inferred = {
      length: 17.25,
      width: 1.5,
      thickness: 1.5,
      measured: {
        length: { value: 17.25, source: "inferred" as const, confidence: 0.45 },
        width: { value: 1.5, source: "inferred" as const, confidence: 0.45 },
        thickness: { value: 1.5, source: "inferred" as const, confidence: 0.45 },
      },
      locked: { length: false, width: false, thickness: false, qty: false },
    } as Pick<CutRow, "measured" | "locked">;
    assert.equal(isCutAxisUnconfirmed(inferred, "length"), true);
    const locked = {
      ...inferred,
      locked: { length: true, width: true, thickness: true, qty: false },
    };
    assert.equal(isCutAxisUnconfirmed(locked, "length"), false);
    assert.equal(formatCutAxisSource(locked, "length"), "locked — your tape");
  });

  it("prints a locked override instead of ?", () => {
    const cut = {
      length: 48,
      width: 14,
      thickness: 0.875,
      measured: sourced,
      locked: { length: false, width: false, thickness: true, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(formatCutAxis(cut, "thickness"), `7/8"`);
    assert.equal(editorAxisValue(cut, "thickness"), 0.875);
  });

  it("does not hint a cut-ready photo or guess size on locked or unknown axes", () => {
    const measured = {
      ...sourced,
      length: { value: 48, source: "measured" as const, confidence: 0.9, photoIndex: 0 },
    };
    const lockedUnknown = {
      length: 48,
      width: 14,
      thickness: 0.875,
      measured,
      locked: { length: false, width: false, thickness: true, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(formatCutAxisSource(lockedUnknown, "thickness"), "locked — your tape");
    assert.equal(formatCutAxisSource(lockedUnknown, "length"), "measured from photo 1");
    assert.match(formatCutSources(lockedUnknown), /T locked — your tape/);
    assert.doesNotMatch(formatCutSources(lockedUnknown), /T verify before cut/);

    const unlockedUnknown = {
      length: 16,
      width: 16,
      thickness: 0,
      measured: sourced,
      locked: { length: false, width: false, thickness: false, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(formatCutAxisSource(unlockedUnknown, "thickness"), "verify before cut");
    assert.doesNotMatch(formatCutAxisSource(unlockedUnknown, "thickness"), /measured|guessed/);

    const claimedMeasuredButNull = {
      length: 16,
      width: 16,
      thickness: 0,
      measured: {
        ...sourced,
        thickness: { value: null, source: "measured" as const, confidence: 0.9, photoIndex: 0 },
      },
      locked: { length: false, width: false, thickness: false, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(formatCutAxisSource(claimedMeasuredButNull, "thickness"), "verify before cut");
  });

  it("does not bind a fallback inch into the editor for an unknown axis", () => {
    const cut = {
      length: 16,
      width: 16,
      thickness: 0,
      measured: sourced,
      locked: { length: false, width: false, thickness: false, qty: false },
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(editorAxisValue(cut, "thickness"), null);
    assert.equal(editorAxisValue(cut, "length"), 16);
    const catalog = {
      length: 48,
      width: 14,
      thickness: 0.75,
    } as Pick<CutRow, "length" | "width" | "thickness" | "measured" | "locked">;
    assert.equal(editorAxisValue(catalog, "thickness"), 0.75);
  });

  it("labels sourced, inferred, and unknown dims in builder language", () => {
    assert.equal(
      formatDimSource({
        value: 14,
        source: "measured",
        confidence: 0.9,
        photoIndex: 0,
      }),
      "measured from photo 1",
    );
    assert.equal(
      formatDimSource({ value: 14, source: "measured", confidence: 0.9 }),
      "guessed — verify",
    );
    assert.equal(
      formatDimSource({ value: null, source: "measured", confidence: 0.9, photoIndex: 0 }),
      "verify before cut",
    );
    assert.equal(
      formatDimSource({ value: 16, source: "inferred", confidence: 0.4 }),
      "guessed — verify",
    );
    assert.equal(
      formatDimSource({
        value: 17.5,
        source: "inferred",
        confidence: 0.45,
        note: "guessed from seat height — verify",
      }),
      "guessed from seat height — verify",
    );
    assert.equal(
      formatDimSource({
        value: 15,
        source: "inferred",
        confidence: 0.45,
        note: "guessed from the clear span — verify",
      }),
      "guessed from the clear span — verify",
    );
    assert.equal(formatDimSource(unknownDim("underside not visible")), "verify before cut");
    assert.equal(formatDimSource(undefined), "");
  });

  it("stays silent on catalog parts with no MeasuredDim", () => {
    assert.equal(formatCutSources({}), "");
    assert.equal(formatCutAxisSource({}, "length"), "");
    assert.equal(formatDoNotCut({ doNotCut: false, scaleNotes: ["Tape in frame."] }), null);
  });

  it("prints a route-refuse hold even without scale notes", () => {
    const hold = formatDoNotCut({
      doNotCut: true,
      routeRunnable: false,
    });
    assert.ok(hold);
    assert.equal(hold.headline, DONT_CUT_YET);
    assert.match(hold.text, /Don't cut yet/);
    assert.match(hold.text, /tools on the bench/);
    assert.equal(hold.notes.length, 1);
    assert.doesNotMatch(hold.text, /mortise|pocket/i);
  });

  it("prints one BLUF don't-cut; scale notes stay off the hold", () => {
    const hold = formatDoNotCut({
      doNotCut: true,
      scaleConfidence: "low",
      unknownAxes: 1,
      scaleNotes: [
        "No tape or labeled dimension in frame.",
        "Underside not visible — seat thickness unknown.",
      ],
    });
    assert.ok(hold);
    assert.equal(hold.headline, DONT_CUT_YET);
    assert.equal(hold.notes.length, 1);
    assert.match(hold.text, /Don't cut yet/);
    assert.equal(hold.notes[0], HOLD_BODY.photo);
    assert.doesNotMatch(hold.text, /\?/);
    assert.doesNotMatch(hold.text, /No tape/);
    assert.doesNotMatch(hold.text, /Underside not visible/);
  });
});
