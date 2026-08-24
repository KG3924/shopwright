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
});
