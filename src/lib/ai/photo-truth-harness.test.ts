import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compilePacket } from "../compile";
import { formatCutTriplet } from "../measure";
import { NO_ROUTE_ID } from "../routes";
import { figuresForStep } from "../technique-drawings";
import { hydrateVision, parseVisionJson, type InterpretInput } from "./hydrate";
import {
  INTERPRET_LEAK_RE,
  assertPhotoTruthJson,
  comparePromptVariants,
  jsonLeakHits,
  loadFrozenBarrosAi,
  scorePromptVariant,
} from "./photo-truth-harness";
import { loadInterpretPrompt } from "./prompts";
import { INTERPRET_SYSTEM } from "./interpret-system";
import type { ShopPacket } from "../types";

const dir = dirname(fileURLToPath(import.meta.url));
const LIVE = process.env.SHOPWRIGHT_LIVE_INTERPRET === "1" && Boolean(process.env.XAI_API_KEY);

const pocketInput: InterpretInput = {
  kind: "photo",
  rank: "beginner",
  toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
};

function packetStory(packet: ShopPacket): string {
  return [
    packet.route.id,
    packet.route.name,
    packet.route.summary,
    packet.route.joinery,
    ...packet.hardware.map((h) => `${h.id} ${h.name} ${h.spec} ${h.where ?? ""}`),
    ...packet.steps.map((s) => `${s.id} ${s.title} ${s.body} ${s.techniques.join(" ")}`),
    ...packet.techniques.map((t) => `${t.id} ${t.name} ${t.body}`),
    ...packet.cuts.map((c) => `${c.letter} ${c.name} ${c.notes ?? ""}`),
    ...packet.warnings,
    packet.project.interpretation,
  ].join("\n");
}

describe("photo-truth swap harness", () => {
  it("loads photo-truth and shop-form as named instruction variants", () => {
    const photoTruth = loadInterpretPrompt("photo-truth");
    const shopForm = loadInterpretPrompt("shop-form");
    assert.equal(INTERPRET_SYSTEM, photoTruth);
    assert.notEqual(photoTruth, shopForm);
    assert.match(photoTruth, /PHOTO-TRUTH|shop-truth|DO NOT INVENT/i);
    assert.match(shopForm, /You are Shopwright, a master furniture maker reading PHOTOGRAPHS/);
  });

  it("Photo-Truth wins the variant compare: required seat/finish/backStyle, no catalog joinery in the JSON shape", () => {
    const result = comparePromptVariants();
    assert.equal(result.winner, "photo-truth");
    assert.ok(
      result.photoTruth.score > result.shopForm.score,
      `photo-truth ${result.photoTruth.score} must beat shop-form ${result.shopForm.score}`,
    );
    assert.equal(result.photoTruth.missingRequired.length, 0, result.photoTruth.missingRequired.join("; "));
    assert.ok(
      result.shopForm.missingRequired.length > 0,
      "shop-form should lack the photo-truth JSON fields so the swap is measurable",
    );
  });

  it("frozen Barros-class interpret JSON has no lattice/enamel/primer/Paint-A leak strings", () => {
    const ai = loadFrozenBarrosAi();
    assertPhotoTruthJson(ai);
    assert.equal(jsonLeakHits(ai).length, 0);
    assert.equal(ai.templateId, "side-chair");
    assert.ok(ai.drawing && typeof ai.drawing === "object");
    const drawing = ai.drawing as { backStyle?: string };
    assert.notEqual(drawing.backStyle, "lattice");
    assert.ok(
      drawing.backStyle === "solid" || drawing.backStyle === "crest",
      `Barros backStyle should be solid or crest, got ${drawing.backStyle}`,
    );
    assert.equal(ai.seat, "upholstered");
    assert.equal(ai.finish, "clear");
    const blob = JSON.stringify(ai);
    assert.doesNotMatch(blob, INTERPRET_LEAK_RE);
    assert.doesNotMatch(blob, /"routes"|"hardware"|"steps"/);
  });

  it("rejects a catalog-leak interpret JSON (lattice / enamel / Paint A)", () => {
    const leak = JSON.parse(
      readFileSync(join(dir, "fixtures", "barros-catalog-leak.json"), "utf8"),
    ) as { ai: unknown };
    const hits = jsonLeakHits(leak.ai);
    assert.ok(hits.length > 0, "catalog-leak fixture must contain leak strings so the harness can fail it");
    assert.throws(() => assertPhotoTruthJson(leak.ai));
  });

  it("compile of frozen Barros JSON emits no lattice / enamel / Paint A, including No-route", () => {
    const ai = parseVisionJson(JSON.stringify(loadFrozenBarrosAi()));
    const project = hydrateVision(ai, pocketInput, []);
    const packet = compilePacket(project, "75013");
    const story = packetStory(packet);
    assert.doesNotMatch(story, INTERPRET_LEAK_RE, story);
    assert.ok(!packet.hardware.some((h) => h.id === "pins-ch" || h.id === "primer-ch"));
    assert.ok(!packet.steps.some((s) => s.id === "sc5" || s.id === "sc6"));
    assert.ok(!packet.steps.some((s) => s.techniques.includes("half-lap")));
    assert.ok(!packet.steps.some((s) => s.techniques.includes("finish-paint")));
    for (const step of packet.steps) {
      assert.ok(!figuresForStep(step.techniques).includes("half-lap"));
      assert.ok(!figuresForStep(step.techniques).includes("finish-paint"));
    }

    const seat = packet.cuts.find((c) => c.letter === "A" || c.role === "seat")!;
    assert.equal(seat.letter, "A");
    assert.equal(formatCutTriplet(seat), `18" × 16-1/2" × 3/4"`);
    assert.doesNotMatch(seat.notes ?? "", /45\s*°|diamond|lattice|enamel|primer/i);

    const none = compilePacket(
      hydrateVision(ai, { ...pocketInput, toolsAvailable: [] }, []),
      "75013",
    );
    assert.equal(none.route.id, NO_ROUTE_ID);
    assert.doesNotMatch(packetStory(none), INTERPRET_LEAK_RE);
  });

  it("scores photo-truth higher than shop-form on the same frozen fixture without calling xAI", () => {
    const photo = scorePromptVariant("photo-truth");
    const shop = scorePromptVariant("shop-form");
    assert.ok(photo.score > shop.score);
    assert.match(loadInterpretPrompt("photo-truth"), /Unreadable axis|source unknown/i);
    assert.match(loadInterpretPrompt("photo-truth"), /templateId is NOT a joinery source/i);
  });

  it("optional live xAI path is not on CI", { skip: !LIVE }, async () => {
    assert.ok(process.env.XAI_API_KEY);
  });
});
