import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTemplate } from "./catalog";
import { compilePacket, instantiate } from "./compile";
import { inferDrawing } from "./drawing";
import {
  explodeLetteredBlanks,
  layoutBoxes,
  letteredBlanks,
  type WorldBox,
} from "./layout";
import { explodeOffset } from "./shop-views";
import type { Project, ShopTool } from "./types";

const TOOLS: ShopTool[] = ["drill", "miter-saw", "kreg-jig", "clamps"];

function packetFor(id: string) {
  const template = getTemplate(id);
  assert.ok(template, `missing catalog piece ${id}`);
  const project = instantiate(template, {
    rank: "beginner",
    toolsAvailable: TOOLS,
  });
  return { project, packet: compilePacket(project, "75013") };
}

function explodeOf(project: Project, cuts: Parameters<typeof explodeLetteredBlanks>[1]) {
  const spec = inferDrawing(project);
  return explodeLetteredBlanks(project.overall, cuts, {
    explode: explodeOffset(project.overall),
    seatHeightRatio: spec.seatHeightRatio,
  });
}

function aabbOverlap(a: WorldBox, b: WorldBox): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.d &&
    a.y + a.d > b.y &&
    a.z < b.z + b.h &&
    a.z + a.h > b.z
  );
}

describe("lettered explode blanks", () => {
  it("keeps one blank per ticket letter, not every assembled copy", () => {
    const stacked: WorldBox[] = [
      {
        id: "seat-0",
        letter: "A",
        name: "Seat",
        role: "seat",
        x: 0,
        y: 0,
        z: 16,
        w: 16,
        d: 14,
        h: 0.75,
      },
      {
        id: "leg-0",
        letter: "B",
        name: "Leg",
        role: "leg",
        x: 0,
        y: 0,
        z: 0,
        w: 1.5,
        d: 1.5,
        h: 17,
      },
      {
        id: "leg-1",
        letter: "B",
        name: "Leg",
        role: "leg",
        x: 14.5,
        y: 0,
        z: 0,
        w: 1.5,
        d: 1.5,
        h: 17,
      },
      {
        id: "slat-0",
        letter: "E",
        name: "Slat",
        role: "slat",
        x: 3,
        y: 12,
        z: 16,
        w: 0.75,
        d: 0.4,
        h: 12,
      },
      {
        id: "slat-1",
        letter: "E",
        name: "Slat",
        role: "slat",
        x: 6,
        y: 12,
        z: 16,
        w: 0.75,
        d: 0.4,
        h: 12,
      },
    ];
    const blanks = letteredBlanks(stacked);
    assert.deepEqual(
      blanks.map((b) => b.letter),
      ["A", "B", "E"],
    );
    assert.equal(blanks.length, 3);
  });

  it("bench explode letters match the tickets and pull copies apart", () => {
    const { project, packet } = packetFor("bench");
    const assembled = layoutBoxes(project.overall, packet.cuts);
    const exploded = explodeOf(project, packet.cuts);
    const tickets = packet.cuts.map((c) => c.letter);

    assert.ok(assembled.length > exploded.length, "explode must drop duplicate copies");
    assert.equal(exploded.length, tickets.length);
    assert.deepEqual(
      exploded.map((b) => b.letter).sort(),
      [...tickets].sort(),
    );
    assert.equal(assembled.filter((b) => b.letter === "B").length, 4);
    assert.equal(exploded.filter((b) => b.letter === "B").length, 1);

    for (let i = 0; i < exploded.length; i++) {
      for (let j = i + 1; j < exploded.length; j++) {
        assert.equal(
          aabbOverlap(exploded[i]!, exploded[j]!),
          false,
          `stacked explode blanks ${exploded[i]!.letter} and ${exploded[j]!.letter}`,
        );
      }
    }
  });

  it("lattice chair explode is one lettered blank per cut-list row", () => {
    const { project, packet } = packetFor("side-chair");
    const exploded = explodeOf(project, packet.cuts);
    const tickets = packet.cuts.map((c) => c.letter);
    assert.equal(new Set(tickets).size, tickets.length);
    assert.equal(exploded.length, tickets.length);
    assert.deepEqual(
      exploded.map((b) => b.letter).sort(),
      [...tickets].sort(),
    );
    const lattice = packet.cuts.find((c) => /lattice/i.test(c.name));
    assert.ok(lattice);
    assert.ok(lattice.qty > 1);
    assert.equal(exploded.filter((b) => b.letter === lattice.letter).length, 1);
  });

  it("uses the quiet explode for every rank — spacing is not a rank switch", () => {
    const { project, packet } = packetFor("bench");
    const spec = inferDrawing(project);
    const quiet = explodeOffset(project.overall, "beginner");
    const a = explodeLetteredBlanks(project.overall, packet.cuts, {
      explode: explodeOffset(project.overall, "beginner"),
      seatHeightRatio: spec.seatHeightRatio,
    });
    const b = explodeLetteredBlanks(project.overall, packet.cuts, {
      explode: explodeOffset(project.overall, "master"),
      seatHeightRatio: spec.seatHeightRatio,
    });
    assert.equal(quiet, explodeOffset(project.overall, "master"));
    assert.deepEqual(
      a.map((box) => [box.letter, box.x, box.y, box.z]),
      b.map((box) => [box.letter, box.x, box.y, box.z]),
    );
  });
});
