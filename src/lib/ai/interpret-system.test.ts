import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INTERPRET_SYSTEM } from "./interpret-system";

describe("INTERPRET_SYSTEM", () => {
  it("requires seat profile language and treats a box outline as a failed chair reading", () => {
    assert.match(INTERPRET_SYSTEM, /REQUIRED ON EVERY CHAIR/);
    assert.match(INTERPRET_SYSTEM, /seatProfile/);
    assert.match(INTERPRET_SYSTEM, /sideOutline/);
    assert.match(INTERPRET_SYSTEM, /HONESTY/);
    assert.match(INTERPRET_SYSTEM, /failed reading/);
    assert.match(INTERPRET_SYSTEM, /4-corner rectangle|4-point rectangle|A rectangle is a failure/);
  });

  it("translates metal or plastic photos into a wood shop packet instead of refusing", () => {
    assert.match(INTERPRET_SYSTEM, /MATERIAL TRANSLATION/);
    assert.match(INTERPRET_SYSTEM, /translated to wood build/);
    assert.match(INTERPRET_SYSTEM, /never steel/i);
    assert.match(INTERPRET_SYSTEM, /Do not refuse a metal or plastic piece/);
    assert.match(INTERPRET_SYSTEM, /category chair, templateId side-chair/);
  });

  it("does not trace factory CAD, hidden lines, or odd diagonals from metal product drawings", () => {
    assert.match(INTERPRET_SYSTEM, /hidden line|CAD|line drawing/i);
    assert.match(INTERPRET_SYSTEM, /constructed shop elevation|from the wood parts|from parts/i);
    assert.match(INTERPRET_SYSTEM, /diagonal slash|odd diagonal/i);
    assert.match(INTERPRET_SYSTEM, /translated to wood build/);
  });
});
