import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getTemplate } from "./catalog";
import { compilePacket, instantiate } from "./compile";
import { UNEXPLAINED_JARGON_RE, TECHNIQUE_PLAIN } from "./plain-copy";
import { TECHNIQUES } from "./techniques";
import {
  figuresForStep,
  techniqueCaption,
  techniqueCast,
  techniqueLettersKey,
  techniquePlainName,
} from "./technique-drawings";
import { hydrateVision, parseVisionJson, type InterpretInput } from "./ai/hydrate";
import type { ShopTool } from "./types";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "ai/fixtures");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const POCKET_TOOLS: ShopTool[] = ["drill", "miter-saw", "kreg-jig", "clamps"];
const MORTISE_TOOLS: ShopTool[] = ["mortiser", "chisels", "clamps", "tenon-saw"];
const DADO_TOOLS: ShopTool[] = ["table-saw", "clamps", "drill"];

function packetLetters(cuts: { letter: string }[]): Set<string> {
  return new Set(cuts.map((c) => c.letter));
}

function assertCastOnTickets(
  cast: { host?: string; guest?: string; extra?: string },
  letters: Set<string>,
) {
  for (const mark of [cast.host, cast.guest, cast.extra]) {
    if (mark) assert.ok(letters.has(mark), `letter ${mark} missing from tickets`);
  }
}

describe("technique drawings", () => {
  it("covers every technique module with beginner chrome", () => {
    for (const tech of TECHNIQUES) {
      assert.ok(TECHNIQUE_PLAIN[tech.id], `missing TECHNIQUE_PLAIN for ${tech.id}`);
      assert.ok(techniquePlainName(tech.id));
    }
    for (const [id, copy] of Object.entries(TECHNIQUE_PLAIN)) {
      for (const text of [copy.name, copy.bluf, copy.hostFallback, copy.guestFallback, copy.extraFallback]) {
        assert.doesNotMatch(text, UNEXPLAINED_JARGON_RE, `jargon in ${id}: ${text}`);
      }
    }
  });

  it("bench pocket route letters match tickets B · C", () => {
    const bench = getTemplate("bench")!;
    const packet = compilePacket(
      instantiate(bench, { routeId: "pocket", toolsAvailable: POCKET_TOOLS }),
      "75013",
    );
    assert.equal(packet.route.id, "pocket");
    const letters = packetLetters(packet.cuts);
    assert.ok(letters.has("B"));
    assert.ok(letters.has("C"));
    const cast = techniqueCast(packet.cuts, "pocket-hole");
    assert.equal(cast.host, "B");
    assert.equal(cast.guest, "C");
    assertCastOnTickets(cast, letters);
    const caption = techniqueCaption("pocket-hole", packet.cuts)!;
    assert.match(caption, /\bB\b/);
    assert.match(caption, /\bC\b/);
    assert.doesNotMatch(caption, UNEXPLAINED_JARGON_RE);
    const pocketStep = packet.steps.find((s) => s.techniques.includes("pocket-hole"));
    assert.ok(pocketStep);
    assert.deepEqual(figuresForStep(pocketStep.techniques), ["pocket-hole", "clamp-up"]);
  });

  it("bench mortise route uses tongue/pocket copy and the same ticket letters", () => {
    const bench = getTemplate("bench")!;
    const packet = compilePacket(
      instantiate(bench, { routeId: "mortise", toolsAvailable: MORTISE_TOOLS }),
      "75013",
    );
    assert.equal(packet.route.id, "mortise");
    const letters = packetLetters(packet.cuts);
    const cast = techniqueCast(packet.cuts, "mortise-tenon");
    assert.equal(cast.host, "B");
    assert.equal(cast.guest, "C");
    assertCastOnTickets(cast, letters);
    const caption = techniqueCaption("mortise-tenon", packet.cuts)!;
    assert.match(caption, /tongue and the pocket it fits into/i);
    assert.match(caption, /\bB\b/);
    assert.match(caption, /\bC\b/);
    assert.doesNotMatch(caption, UNEXPLAINED_JARGON_RE);
    assert.doesNotMatch(caption, /haunch/i);
    const step = packet.steps.find((s) => s.techniques.includes("mortise-tenon"));
    assert.ok(step);
    assert.deepEqual(figuresForStep(step.techniques), ["mortise-tenon", "clamp-up"]);
  });

  it("lattice chair half-lap letters match C stile, G rail, J lattice", () => {
    const chair = getTemplate("side-chair")!;
    const packet = compilePacket(
      instantiate(chair, { routeId: "pocket", toolsAvailable: POCKET_TOOLS }),
      "75013",
    );
    const letters = packetLetters(packet.cuts);
    const cast = techniqueCast(packet.cuts, "half-lap");
    assert.equal(cast.host, "C");
    assert.equal(cast.guest, "J");
    assert.equal(cast.extra, "G");
    assertCastOnTickets(cast, letters);
    assert.equal(techniqueLettersKey(cast), "C·J·G");
    const pocket = techniqueCast(packet.cuts, "pocket-hole");
    assert.equal(pocket.host, "B");
    assert.equal(pocket.guest, "D");
    assertCastOnTickets(pocket, letters);
  });

  it("photo stool packet keeps drawing letters on the tickets it actually has", () => {
    const ai = parseVisionJson(
      JSON.stringify(
        (JSON.parse(readFileSync(join(fixtureDir, "tape-stool-pass.json"), "utf8")) as { ai: unknown }).ai,
      ),
    );
    const input: InterpretInput = {
      kind: "photo",
      rank: "beginner",
      toolsAvailable: POCKET_TOOLS,
    };
    const project = hydrateVision(ai, input, []);
    project.routeId = "pocket";
    const packet = compilePacket(project, "75013");
    const letters = packetLetters(packet.cuts);
    const seat = packet.cuts.find((c) => c.name === "Seat");
    const leg = packet.cuts.find((c) => c.name === "Leg");
    assert.ok(seat && leg);
    const pocket = techniqueCast(packet.cuts, "pocket-hole");
    assert.equal(pocket.host, leg.letter);
    assert.equal(pocket.guest, undefined);
    assertCastOnTickets(pocket, letters);
    const caption = techniqueCaption("pocket-hole", packet.cuts)!;
    assert.match(caption, new RegExp(`\\b${leg.letter}\\b`));
    assert.doesNotMatch(caption, UNEXPLAINED_JARGON_RE);
    const glue = techniqueCast(packet.cuts, "glue-up");
    assert.equal(glue.host, seat.letter);
    assertCastOnTickets(glue, letters);
  });

  it("bookcase dado letters match side and shelf tickets", () => {
    const bookcase = getTemplate("bookcase")!;
    const packet = compilePacket(
      instantiate(bookcase, { routeId: "dado", toolsAvailable: DADO_TOOLS }),
      "75013",
    );
    assert.equal(packet.route.id, "dado");
    const side = packet.cuts.find((c) => c.role === "side")!;
    const shelf = packet.cuts.find((c) => c.role === "shelf")!;
    const cast = techniqueCast(packet.cuts, "dado");
    assert.equal(cast.host, side.letter);
    assert.equal(cast.guest, shelf.letter);
    const caption = techniqueCaption("dado", packet.cuts)!;
    assert.match(caption, /three-sided trench/);
    assert.match(caption, new RegExp(`\\b${side.letter}\\b`));
    assert.match(caption, new RegExp(`\\b${shelf.letter}\\b`));
    assert.doesNotMatch(caption, UNEXPLAINED_JARGON_RE);
  });

  it("wires figures into Build tab and assembly steps without touching explode geometry", () => {
    const studio = read("src/components/studio-view.tsx");
    const drawings = read("src/components/shop-drawings.tsx");
    const views = read("src/lib/shop-views.ts");
    assert.match(studio, /data-build-steps/);
    assert.match(studio, /TechniqueFigures/);
    assert.match(studio, /PACKET_COPY\.buildLead/);
    assert.match(studio, /techniquePlainName/);
    assert.doesNotMatch(studio, /RANK_META\[route\.recommendedRank\]/);
    assert.match(drawings, /TechniqueFigures ids=\{step\.techniques\}/);
    assert.match(drawings, /PACKET_COPY\.assemblySummary/);
    assert.match(views, /return max \* 0\.3/);
    assert.match(drawings, /explode: explodeOffset\(overall\)/);
    assert.match(drawings, /function IsoScene\(\{ boxes \}: \{ boxes: WorldBox\[\] \}\)/);
  });

  it("does not invent a letter that is not on the packet", () => {
    const cuts = [
      { id: "p1", letter: "A", name: "Seat", role: "seat" as const },
    ];
    const cast = techniqueCast(cuts, "pocket-hole");
    assert.equal(cast.host, undefined);
    assert.equal(cast.guest, undefined);
    const caption = techniqueCaption("pocket-hole", cuts)!;
    assert.doesNotMatch(caption, /\b[A-Z]\b/);
    assert.match(caption, /connecting rail/);
  });
});
