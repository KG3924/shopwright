import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compilePacket, instantiate } from "../compile";
import { formatCutAxis, formatCutTriplet } from "../measure";
import { getTemplate } from "../catalog";
import {
  hydrateVision,
  InterpretError,
  parseVisionJson,
  type AiJson,
  type InterpretInput,
} from "./hydrate";

const input: InterpretInput = { kind: "photo", rank: "beginner" };

function twoBoards(over: Partial<AiJson> = {}): AiJson {
  return {
    name: "Photo stool",
    category: "chair",
    templateId: "side-chair",
    interpretation: "A small stool from the photos.",
    confidence: 0.7,
    overall: { w: 16, d: 16, h: 18 },
    overallSource: "estimated",
    scaleConfidence: "high",
    parts: [
      {
        name: "Photo seat",
        qty: 1,
        length: { value: 16, source: "measured", confidence: 0.9 },
        width: { value: 16, source: "measured", confidence: 0.9 },
        thickness: { value: 0.75, source: "inferred", confidence: 0.4 },
        role: "seat",
      },
      {
        name: "Photo leg",
        qty: 4,
        length: { value: 17.25, source: "inferred", confidence: 0.5 },
        width: { value: 1.5, source: "inferred", confidence: 0.4 },
        thickness: { value: 1.5, source: "inferred", confidence: 0.4 },
        role: "leg",
      },
    ],
    ...over,
  };
}

describe("parseVisionJson", () => {
  it("fails loud on non-JSON", () => {
    assert.throws(() => parseVisionJson("sorry, no furniture"), (err: unknown) => {
      return err instanceof InterpretError && err.code === "invalid_json";
    });
  });

  it("fails loud when JSON has no parts", () => {
    assert.throws(
      () => parseVisionJson('{"name":"Bench","overall":{"w":48,"d":14,"h":18}}'),
      (err: unknown) => err instanceof InterpretError && err.code === "incomplete_parts",
    );
  });

  it("accepts fenced JSON with MeasuredDim parts", () => {
    const ai = parseVisionJson("```json\n" + JSON.stringify(twoBoards()) + "\n```");
    assert.equal(ai.parts?.length, 2);
    assert.equal(ai.scaleConfidence, "high");
  });
});

describe("hydrateVision", () => {
  it("uses vision parts and never emits template stock ids", () => {
    const project = hydrateVision(twoBoards(), input, []);
    assert.equal(project.sourceKind, "photo");
    assert.equal(project.partsFromPhotos, true);
    assert.ok(project.id.endsWith("-read"));
    assert.deepEqual(
      project.parts.map((p) => p.name),
      ["Photo seat", "Photo leg"],
    );
    assert.ok(project.parts.every((p) => p.id.startsWith("p")));
    assert.ok(!project.parts.some((p) => p.id === "apron-l" || p.id === "top"));
    assert.ok(project.routes.length > 0);
    assert.ok(project.parts[0]?.measured?.length.source === "measured");
  });

  it("throws instead of substituting template parts when fewer than two boards are sourced", () => {
    const one = twoBoards({
      parts: [
        {
          name: "Lonely top",
          qty: 1,
          length: { value: 48, source: "measured", confidence: 0.9 },
          width: { value: 14, source: "measured", confidence: 0.9 },
          thickness: { value: 0.75, source: "inferred", confidence: 0.4 },
        },
      ],
    });
    assert.throws(
      () => hydrateVision(one, input, []),
      (err: unknown) => err instanceof InterpretError && err.code === "incomplete_parts",
    );
  });

  it("throws when parts exist but axes are unknown", () => {
    const unsourced = twoBoards({
      parts: [
        {
          name: "Guess A",
          qty: 1,
          length: { value: null, source: "unknown", confidence: 0 },
          width: { value: null, source: "unknown", confidence: 0 },
          thickness: { value: null, source: "unknown", confidence: 0 },
        },
        {
          name: "Guess B",
          qty: 1,
          length: { value: null, source: "unknown", confidence: 0 },
          width: { value: null, source: "unknown", confidence: 0 },
          thickness: { value: null, source: "unknown", confidence: 0 },
        },
      ],
    });
    assert.throws(
      () => hydrateVision(unsourced, input, []),
      (err: unknown) => err instanceof InterpretError && err.code === "incomplete_parts",
    );
  });

  it("does not invent overall from the template when vision omitted it", () => {
    const noOverall = twoBoards({ overall: undefined });
    assert.throws(
      () => hydrateVision(noOverall, input, []),
      (err: unknown) => err instanceof InterpretError && err.code === "missing_overall",
    );
  });

  it("does not invent typical stock thickness as a measured value", () => {
    const project = hydrateVision(
      twoBoards({
        parts: [
          {
            name: "Photo seat",
            qty: 1,
            lengthIn: 16,
            widthIn: 16,
            role: "seat",
          },
          {
            name: "Photo leg",
            qty: 4,
            lengthIn: 17,
            widthIn: 1.5,
            role: "leg",
          },
        ],
      }),
      input,
      [],
    );
    assert.equal(project.parts[0]?.measured?.thickness.source, "unknown");
    assert.equal(project.parts[0]?.measured?.thickness.value, null);
    const packet = compilePacket(project, "75013");
    assert.equal(formatCutAxis(packet.cuts[0]!, "thickness"), "?");
    assert.equal(packet.doNotCut, true);
  });

  it("sets doNotCut and keeps vision parts when scale is low", () => {
    const project = hydrateVision(
      twoBoards({ scaleConfidence: "low", overallSource: "assumed" }),
      input,
      [],
    );
    assert.equal(project.doNotCut, true);
    assert.equal(project.scaleConfidence, "low");
    const packet = compilePacket(project, "75013");
    assert.equal(packet.doNotCut, true);
    assert.ok(packet.warnings.some((w) => /do not cut/i.test(w)));
    assert.ok(packet.cuts.every((c) => c.id.startsWith("p")));
  });

  it("marks conflict scale as doNotCut", () => {
    const project = hydrateVision(twoBoards({ scaleConfidence: "conflict" }), input, []);
    assert.equal(project.scaleConfidence, "conflict");
    assert.equal(project.doNotCut, true);
  });

  it("accepts legacy lengthIn/widthIn/thicknessIn as inferred, not measured", () => {
    const project = hydrateVision(
      twoBoards({
        parts: [
          {
            name: "Legacy top",
            qty: 1,
            lengthIn: 40,
            widthIn: 12,
            thicknessIn: 0.75,
          },
          {
            name: "Legacy apron",
            qty: 2,
            lengthIn: 37,
            widthIn: 3.5,
            thicknessIn: 0.75,
          },
        ],
      }),
      input,
      [],
    );
    assert.equal(project.parts[0]?.measured?.length.source, "inferred");
    assert.equal(project.parts[0]?.measured?.length.value, 40);
    assert.notEqual(project.parts[0]?.id, "top");
  });
});

describe("catalog path", () => {
  it("stays unchanged for sourceKind catalog", () => {
    const bench = getTemplate("bench");
    assert.ok(bench);
    const project = instantiate(bench, { rank: "beginner" });
    assert.equal(project.sourceKind, "catalog");
    assert.equal(project.doNotCut, undefined);
    assert.ok(project.parts.some((p) => p.id === "apron-l"));
    const packet = compilePacket(project, "75013");
    assert.equal(packet.doNotCut, false);
    assert.ok(!packet.warnings.some((w) => /do not cut yet/i.test(w)));
    const top = packet.cuts.find((c) => c.id === "top");
    assert.ok(top);
    assert.equal(formatCutAxis(top, "length"), `48"`);
    assert.equal(formatCutTriplet(top).includes("?"), false);
  });
});
