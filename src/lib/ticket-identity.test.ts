import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getTemplate } from "./catalog";
import { compilePacket, instantiate } from "./compile";
import { formatCutSources, formatCutTriplet, ticketIdentity } from "./measure";
import type { CutRow } from "./types";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function partTicketSource() {
  const src = read("src/components/shop-drawings.tsx");
  const start = src.indexOf("function PartTicket");
  assert.ok(start >= 0, "PartTicket must exist");
  const next = src.indexOf("\nfunction ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

function cut(
  letter: string,
  name: string,
  length: number,
  width: number,
  thickness: number,
  measured?: CutRow["measured"],
): Pick<
  CutRow,
  "letter" | "name" | "length" | "width" | "thickness" | "measured" | "locked"
> {
  return {
    letter,
    name,
    length,
    width,
    thickness,
    measured,
    locked: { length: false, width: false, thickness: false, qty: false },
  };
}

describe("ticket identity", () => {
  it("leads two different cuts with distinct letter + dim lines", () => {
    const seat = ticketIdentity(cut("A", "Seat", 16, 14, 0.75));
    const leg = ticketIdentity(cut("B", "Front leg", 17.5, 1.75, 1.75));
    const stretcher = ticketIdentity(cut("D", "Side stretcher", 14.5, 1.75, 0.75));

    assert.equal(seat.letter, "A");
    assert.equal(seat.name, "Seat");
    assert.equal(seat.dimLine, `16" × 14" × 3/4"`);
    assert.equal(seat.lead, `A · Seat · 16" × 14" × 3/4"`);

    assert.equal(leg.letter, "B");
    assert.equal(leg.dimLine, `17-1/2" × 1-3/4" × 1-3/4"`);
    assert.equal(leg.lead, `B · Front leg · 17-1/2" × 1-3/4" × 1-3/4"`);

    assert.notEqual(seat.lead, leg.lead);
    assert.notEqual(seat.lead, stretcher.lead);
    assert.notEqual(leg.lead, stretcher.lead);
    assert.notEqual(seat.dimLine, leg.dimLine);
    assert.notEqual(seat.dimLine, stretcher.dimLine);
  });

  it("keeps ? and trust labels on the same cut — identity does not invent inches", () => {
    const unknownSeat = cut("A", "Seat", 16, 14, 0, {
      length: { value: 16, source: "measured", confidence: 0.9, photoIndex: 0 },
      width: { value: 14, source: "inferred", confidence: 0.5 },
      thickness: { value: null, source: "unknown", confidence: 0 },
    });
    const identity = ticketIdentity(unknownSeat);
    assert.equal(identity.dimLine, `16" × 14" × ?`);
    assert.equal(identity.lead, `A · Seat · 16" × 14" × ?`);
    assert.equal(identity.dimLine, formatCutTriplet(unknownSeat));
    assert.match(formatCutSources(unknownSeat), /measured from photo 1/);
    assert.match(formatCutSources(unknownSeat), /guessed — verify/);
    assert.match(formatCutSources(unknownSeat), /verify before cut/);
    assert.doesNotMatch(identity.lead, /3\/4|¾/);
  });

  it("compiled bench tickets do not share a leading letter+dim identity", () => {
    const bench = getTemplate("bench");
    assert.ok(bench);
    const packet = compilePacket(
      instantiate(bench, {
        rank: "beginner",
        toolsAvailable: ["drill", "miter-saw", "kreg-jig", "clamps"],
      }),
      "75013",
    );
    const leads = packet.cuts.map((c) => ticketIdentity(c).lead);
    assert.ok(leads.length >= 3);
    assert.equal(new Set(leads).size, leads.length);

    const top = packet.cuts.find((c) => c.name === "Top panel");
    const leg = packet.cuts.find((c) => c.name === "Leg");
    const apron = packet.cuts.find((c) => c.name === "Long apron");
    assert.ok(top && leg && apron);
    assert.equal(ticketIdentity(top).letter, "A");
    assert.match(ticketIdentity(top).dimLine, /48"/);
    assert.equal(ticketIdentity(leg).letter, "B");
    assert.match(ticketIdentity(leg).dimLine, /1-1\/2"/);
    assert.notEqual(ticketIdentity(top).dimLine, ticketIdentity(leg).dimLine);
    assert.notEqual(ticketIdentity(top).lead, ticketIdentity(apron).lead);
  });

  it("PartTicket renders the identity lead before the three lookalike views", () => {
    const drawings = read("src/components/shop-drawings.tsx");
    const ticket = partTicketSource();

    assert.match(drawings, /title="Part tickets"/);
    assert.match(ticket, /ticketIdentity\(cut\)/);
    assert.match(ticket, /identity\.letter/);
    assert.match(ticket, /identity\.dimLine/);
    assert.match(ticket, /data-ticket-identity=\{identity\.lead\}/);
    assert.match(ticket, /formatCutSources/);

    const letterAt = ticket.indexOf("identity.letter");
    const dimAt = ticket.indexOf("identity.dimLine");
    const viewsAt = ticket.indexOf("<BoardView");
    assert.ok(letterAt >= 0 && dimAt >= 0 && viewsAt >= 0);
    assert.ok(letterAt < viewsAt, "letter must lead the ticket, before BoardView");
    assert.ok(dimAt < viewsAt, "primary dim line must lead, before BoardView");

    assert.match(drawings, /formatCutSources\(cut\)/);
    assert.doesNotMatch(ticket, /print:hidden/);
  });
});
