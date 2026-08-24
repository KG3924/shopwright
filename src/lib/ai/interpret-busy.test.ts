import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBusyElapsed, interpretBusyLabel } from "./interpret-busy";

describe("interpretBusyLabel", () => {
  it("reads photos first, then builds the packet", () => {
    assert.equal(interpretBusyLabel("photo", 0), "Reading photos…");
    assert.equal(interpretBusyLabel("photo", 7_999), "Reading photos…");
    assert.equal(interpretBusyLabel("photo", 8_000), "Building packet…");
  });

  it("fetches a link before reading, then builds the packet", () => {
    assert.equal(interpretBusyLabel("url", 0), "Fetching link…");
    assert.equal(interpretBusyLabel("url", 3_999), "Fetching link…");
    assert.equal(interpretBusyLabel("url", 4_000), "Reading photos…");
    assert.equal(interpretBusyLabel("url", 11_999), "Reading photos…");
    assert.equal(interpretBusyLabel("url", 12_000), "Building packet…");
  });
});

describe("formatBusyElapsed", () => {
  it("floors to whole seconds", () => {
    assert.equal(formatBusyElapsed(0), "0s");
    assert.equal(formatBusyElapsed(999), "0s");
    assert.equal(formatBusyElapsed(1_000), "1s");
    assert.equal(formatBusyElapsed(12_400), "12s");
  });
});
