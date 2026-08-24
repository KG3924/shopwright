import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compilePacket } from "../compile";
import { formatCutAxis, formatCutAxisSource, formatDimSource, formatDoNotCut } from "../measure";
import type { Overall, PartMeasured } from "../types";
import { inferFill, type InferCandidate, type InferContext } from "./infer";
import { hydrateVision, type AiJson, type InterpretInput } from "./hydrate";

const overall18: Overall = { w: 18, d: 18, h: 36 };
const highOverall: InferContext = {
  overall: overall18,
  overallSource: "labeled",
  scaleConfidence: "high",
  name: "Dining side chair",
  category: "chair",
  interpretation: "Upright dining chair with a square seat.",
  drawing: { family: "chair", backStyle: "splat", reclined: false },
};

function dim(
  value: number | null,
  source: "measured" | "inferred" | "unknown" = value == null ? "unknown" : "measured",
  extra: Partial<PartMeasured["length"]> = {},
): PartMeasured["length"] {
  return {
    value,
    source,
    confidence: source === "measured" ? 0.9 : source === "inferred" ? 0.45 : 0,
    ...extra,
  };
}

function unknown(): PartMeasured["length"] {
  return dim(null, "unknown");
}

function measuredOf(
  length: PartMeasured["length"],
  width: PartMeasured["length"],
  thickness: PartMeasured["length"],
): PartMeasured {
  return { length, width, thickness };
}

describe("inferFill", () => {
  it("fills a symmetric twin from the leg we saw and never marks it measured", () => {
    const parts: InferCandidate[] = [
      {
        name: "Front left leg",
        role: "leg",
        qty: 1,
        measured: measuredOf(
          dim(17.25, "measured", { photoIndex: 1 }),
          dim(1.5, "measured", { photoIndex: 1 }),
          dim(1.5, "measured", { photoIndex: 1 }),
        ),
      },
      {
        name: "Front right leg",
        role: "leg",
        qty: 1,
        measured: measuredOf(unknown(), unknown(), unknown()),
      },
    ];

    const filled = inferFill(parts, highOverall);
    const twin = filled[1]!;
    assert.equal(twin.measured.length.value, 17.25);
    assert.equal(twin.measured.width.value, 1.5);
    assert.equal(twin.measured.thickness.value, 1.5);
    assert.equal(twin.measured.length.source, "inferred");
    assert.equal(twin.measured.width.source, "inferred");
    assert.equal(twin.measured.thickness.source, "inferred");
    assert.notEqual(twin.measured.length.source, "measured");
    assert.equal(filled[0]!.measured.length.source, "measured");
    assert.match(formatDimSource(twin.measured.length), /guessed from the matching pair — verify/);
  });

  it("does not copy a vision-guessed thickness onto the twin", () => {
    const parts: InferCandidate[] = [
      {
        name: "Front left leg",
        role: "leg",
        qty: 1,
        measured: measuredOf(
          dim(17.25, "measured", { photoIndex: 0 }),
          dim(1.5, "measured", { photoIndex: 0 }),
          dim(0.75, "inferred"),
        ),
      },
      {
        name: "Front right leg",
        role: "leg",
        qty: 1,
        measured: measuredOf(unknown(), unknown(), unknown()),
      },
    ];

    const twin = inferFill(parts, highOverall)[1]!;
    assert.equal(twin.measured.length.value, 17.25);
    assert.equal(twin.measured.thickness.source, "unknown");
    assert.equal(twin.measured.thickness.value, null);
  });

  it("fills stretcher length from the clear span between known legs", () => {
    const parts: InferCandidate[] = [
      {
        name: "Leg",
        role: "leg",
        qty: 4,
        measured: measuredOf(dim(17.25, "measured", { photoIndex: 0 }), dim(1.5, "measured", { photoIndex: 0 }), dim(1.5, "measured", { photoIndex: 0 })),
      },
      {
        name: "Front stretcher",
        role: "stretcher",
        qty: 1,
        measured: measuredOf(unknown(), dim(1.75, "inferred"), dim(0.75, "inferred")),
      },
    ];

    const filled = inferFill(parts, highOverall);
    const stretcher = filled[1]!;
    assert.equal(stretcher.measured.length.value, 15);
    assert.equal(stretcher.measured.length.source, "inferred");
    assert.notEqual(stretcher.measured.length.source, "measured");
    assert.match(formatDimSource(stretcher.measured.length), /guessed from the clear span — verify/);
  });

  it("fills a dining seat-height band on front legs when overall H is the anchor", () => {
    const parts: InferCandidate[] = [
      {
        name: "Seat",
        role: "seat",
        qty: 1,
        measured: measuredOf(dim(18, "measured", { photoIndex: 0 }), dim(18, "measured", { photoIndex: 0 }), unknown()),
      },
      {
        name: "Front leg",
        role: "leg",
        qty: 2,
        measured: measuredOf(unknown(), dim(1.5, "measured", { photoIndex: 1 }), dim(1.5, "measured", { photoIndex: 1 })),
      },
      {
        name: "Back leg",
        role: "leg",
        qty: 2,
        measured: measuredOf(unknown(), dim(1.5, "measured", { photoIndex: 1 }), dim(1.5, "measured", { photoIndex: 1 })),
      },
    ];

    const filled = inferFill(parts, highOverall);
    const front = filled[1]!;
    const back = filled[2]!;
    assert.equal(front.measured.length.source, "inferred");
    assert.ok(front.measured.length.value != null);
    assert.ok(front.measured.length.value >= 17 && front.measured.length.value <= 18);
    assert.match(formatDimSource(front.measured.length), /guessed from seat height — verify/);
    assert.equal(back.measured.length.source, "inferred");
    assert.equal(back.measured.length.value, 36);
    assert.notEqual(back.measured.length.value, front.measured.length.value);
    assert.match(formatDimSource(back.measured.length), /guessed from overall — verify/);
  });

  it("leaves thickness unknown when no edge is visible and never invents 0.75", () => {
    const parts: InferCandidate[] = [
      {
        name: "Seat",
        role: "seat",
        qty: 1,
        measured: measuredOf(unknown(), unknown(), unknown()),
      },
      {
        name: "Leg",
        role: "leg",
        qty: 4,
        measured: measuredOf(dim(17.25, "measured", { photoIndex: 0 }), dim(1.5, "measured", { photoIndex: 0 }), dim(1.5, "measured", { photoIndex: 0 })),
      },
    ];

    const seat = inferFill(parts, highOverall)[0]!;
    assert.equal(seat.measured.length.value, 15);
    assert.equal(seat.measured.width.value, 15);
    assert.equal(seat.measured.length.source, "inferred");
    assert.equal(seat.measured.thickness.source, "unknown");
    assert.equal(seat.measured.thickness.value, null);
    assert.notEqual(seat.measured.thickness.value, 0.75);
    assert.equal(formatDimSource(seat.measured.thickness), "verify before cut");
    assert.match(formatDimSource(seat.measured.length), /guessed from overall — verify/);
  });

  it("does not infer from an assumed low-confidence overall", () => {
    const parts: InferCandidate[] = [
      {
        name: "Seat",
        role: "seat",
        qty: 1,
        measured: measuredOf(unknown(), unknown(), unknown()),
      },
      {
        name: "Front stretcher",
        role: "stretcher",
        qty: 1,
        measured: measuredOf(unknown(), dim(1.75, "inferred"), dim(0.75, "inferred")),
      },
    ];

    const filled = inferFill(parts, {
      overall: { w: 16, d: 16, h: 18 },
      overallSource: "assumed",
      scaleConfidence: "low",
      name: "Guessed stool",
      category: "chair",
    });
    assert.equal(filled[0]!.measured.length.source, "unknown");
    assert.equal(filled[1]!.measured.length.source, "unknown");
  });

  it("does not compute a stretcher span from a vision-guessed 0.75 section", () => {
    const parts: InferCandidate[] = [
      {
        name: "Leg",
        role: "leg",
        qty: 4,
        measured: measuredOf(dim(17.25, "inferred"), dim(0.75, "inferred"), dim(0.75, "inferred")),
      },
      {
        name: "Front stretcher",
        role: "stretcher",
        qty: 1,
        measured: measuredOf(unknown(), dim(1.75, "inferred"), dim(0.75, "inferred")),
      },
    ];
    const stretcher = inferFill(parts, highOverall)[1]!;
    assert.equal(stretcher.measured.length.source, "unknown");
    assert.equal(stretcher.measured.length.value, null);
  });

  it("places a footring from seat height without inventing stretcher stock", () => {
    const parts: InferCandidate[] = [
      {
        name: "Seat",
        role: "seat",
        qty: 1,
        measured: measuredOf(dim(16, "measured", { photoIndex: 0 }), dim(16, "measured", { photoIndex: 0 }), unknown()),
        instances: [{ x: 0, y: 0, z: 17.5, lengthAlong: "x", widthAlong: "y" }],
      },
      {
        name: "Footring",
        role: "stretcher",
        qty: 1,
        measured: measuredOf(unknown(), unknown(), unknown()),
        instances: [{ x: 1.5, y: 0, z: 0, lengthAlong: "x", widthAlong: "z" }],
      },
    ];

    const filled = inferFill(parts, {
      ...highOverall,
      overall: { w: 16, d: 16, h: 18 },
      drawing: { family: "chair", backStyle: "none", hasFootring: true },
      name: "Shop stool",
    });
    const ring = filled[1]!;
    assert.ok(ring.instances?.[0]?.z);
    const z = ring.instances![0]!.z;
    assert.ok(z >= 17.5 / 3 - 0.1 && z <= 17.5 / 2 + 0.1);
    assert.equal(ring.measured.width.source, "unknown");
    assert.equal(ring.measured.thickness.source, "unknown");
  });
});

describe("infer fill through hydrate", () => {
  const input: InterpretInput = { kind: "photo", rank: "beginner" };

  function chairPacket(): AiJson {
    return {
      name: "Dining side chair",
      category: "chair",
      templateId: "side-chair",
      interpretation: "Upright dining chair. Overall labeled on the box.",
      confidence: 0.72,
      overall: { w: 18, d: 18, h: 36 },
      overallSource: "labeled",
      scaleConfidence: "high",
      parts: [
        {
          name: "Seat",
          qty: 1,
          role: "seat",
          length: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
          width: { value: 18, source: "measured", confidence: 0.9, photoIndex: 0 },
          thickness: { value: null, source: "unknown", confidence: 0, note: "underside not visible" },
        },
        {
          name: "Front left leg",
          qty: 1,
          role: "leg",
          length: { value: null, source: "unknown", confidence: 0 },
          width: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 1 },
          thickness: { value: 1.5, source: "measured", confidence: 0.9, photoIndex: 1 },
        },
        {
          name: "Front right leg",
          qty: 1,
          role: "leg",
          length: { value: null, source: "unknown", confidence: 0 },
          width: { value: null, source: "unknown", confidence: 0 },
          thickness: { value: null, source: "unknown", confidence: 0 },
        },
        {
          name: "Front stretcher",
          qty: 1,
          role: "stretcher",
          length: { value: null, source: "unknown", confidence: 0 },
          width: { value: 1.75, source: "inferred", confidence: 0.4 },
          thickness: { value: 0.75, source: "inferred", confidence: 0.35 },
        },
      ],
    };
  }

  it("hydrates inferred axes into the cut list and keeps Don't-cut on remaining unknowns", () => {
    const project = hydrateVision(chairPacket(), input, []);
    const packet = compilePacket(project, "75013");

    const seat = packet.cuts.find((c) => c.name === "Seat")!;
    const left = packet.cuts.find((c) => c.name === "Front left leg")!;
    const right = packet.cuts.find((c) => c.name === "Front right leg")!;
    const stretcher = packet.cuts.find((c) => c.name === "Front stretcher")!;

    assert.equal(formatCutAxis(seat, "thickness"), "?");
    assert.equal(seat.measured?.thickness.source, "unknown");
    assert.equal(seat.measured?.thickness.value, null);

    assert.ok(left.measured?.length.value != null);
    assert.equal(left.measured?.length.source, "inferred");
    assert.equal(formatCutAxisSource(left, "length"), "guessed from seat height — verify");

    assert.equal(right.measured?.width.value, 1.5);
    assert.equal(right.measured?.width.source, "inferred");
    assert.notEqual(right.measured?.width.source, "measured");
    assert.equal(formatCutAxisSource(right, "width"), "guessed from the matching pair — verify");

    assert.equal(stretcher.measured?.length.value, 15);
    assert.equal(stretcher.measured?.length.source, "inferred");
    assert.equal(formatCutAxis(stretcher, "length"), `15"`);
    assert.equal(formatCutAxisSource(stretcher, "length"), "guessed from the clear span — verify");

    assert.equal(packet.doNotCut, true);
    assert.equal(project.doNotCut, false);
    const hold = formatDoNotCut({
      doNotCut: packet.doNotCut,
      routeRunnable: packet.routeRunnable,
      scaleConfidence: project.scaleConfidence,
      unknownAxes: 1,
    });
    assert.ok(hold);
    assert.equal(hold.notes.length, 1);
    assert.ok(!packet.warnings.some((w) => /do not cut/i.test(w)));
  });

  it("keeps Don't-cut on when infer fills the last unknown axes at high scale", () => {
    const project = hydrateVision(
      {
        name: "Shop stool",
        category: "chair",
        templateId: "side-chair",
        interpretation: "Square stool. One front leg fully taped; the twin was occluded.",
        confidence: 0.84,
        overall: { w: 14, d: 14, h: 18 },
        overallSource: "labeled",
        scaleConfidence: "high",
        parts: [
          {
            name: "Seat",
            qty: 1,
            role: "seat",
            length: { value: 14, source: "measured", confidence: 0.95, photoIndex: 0 },
            width: { value: 14, source: "measured", confidence: 0.9, photoIndex: 0 },
            thickness: { value: 0.75, source: "measured", confidence: 0.9, photoIndex: 2 },
          },
          {
            name: "Front left leg",
            qty: 1,
            role: "leg",
            length: { value: 17.25, source: "measured", confidence: 0.9, photoIndex: 1 },
            width: { value: 1.5, source: "measured", confidence: 0.85, photoIndex: 1 },
            thickness: { value: 1.5, source: "measured", confidence: 0.85, photoIndex: 1 },
          },
          {
            name: "Front right leg",
            qty: 1,
            role: "leg",
            length: { value: null, source: "unknown", confidence: 0 },
            width: { value: null, source: "unknown", confidence: 0 },
            thickness: { value: null, source: "unknown", confidence: 0 },
          },
        ],
      },
      {
        ...input,
        toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
      },
      [],
    );
    const packet = compilePacket(project, "75013");
    const right = packet.cuts.find((c) => c.name === "Front right leg")!;
    assert.equal(right.measured?.length.source, "inferred");
    assert.equal(right.measured?.width.source, "inferred");
    assert.equal(right.measured?.thickness.source, "inferred");
    assert.equal(formatCutAxis(right, "length"), `17-1/4"`);
    assert.equal(project.doNotCut, false);
    assert.equal(packet.doNotCut, true);

    project.partOverrides = {
      [right.id]: {
        length: right.length,
        width: right.width,
        thickness: right.thickness,
      },
    };
    const confirmed = compilePacket(project, "75013");
    const lockedRight = confirmed.cuts.find((c) => c.name === "Front right leg")!;
    assert.equal(formatCutAxisSource(lockedRight, "length"), "locked — your tape");
    assert.equal(formatCutAxisSource(lockedRight, "width"), "locked — your tape");
    assert.equal(formatCutAxisSource(lockedRight, "thickness"), "locked — your tape");
    assert.equal(lockedRight.measured?.length.source, "inferred");
    assert.equal(confirmed.doNotCut, false);
  });

  it("does not promote any inferred axis to measured", () => {
    const project = hydrateVision(chairPacket(), input, []);
    for (const part of project.parts) {
      for (const axis of ["length", "width", "thickness"] as const) {
        const d = part.measured?.[axis];
        if (d?.note?.includes("guessed")) {
          assert.equal(d.source, "inferred");
        }
      }
    }
  });
});
