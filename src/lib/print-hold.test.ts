import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("print hold", () => {
  it("puts Don't-cut on the printable shop packet, not a print:hidden screen banner", () => {
    const drawings = read("src/components/shop-drawings.tsx");
    const studio = read("src/components/studio-view.tsx");
    const css = read("src/styles.css");
    const printCss = css.slice(css.indexOf("@media print"));

    assert.match(drawings, /shop-print-hold/);
    const holdLine = drawings
      .split("\n")
      .find((line) => line.includes("shop-print-hold"));
    assert.ok(holdLine);
    assert.doesNotMatch(holdLine, /print:hidden/);

    assert.match(studio, /shop-print-packet/);
    assert.match(studio, /hidden print:block/);

    assert.match(printCss, /header\.sticky/);
    assert.doesNotMatch(printCss, /^\s*header\s*,/m);
    assert.doesNotMatch(printCss, /inset:\s*0/);
    assert.match(printCss, /shop-print-hold/);
    assert.match(printCss, /shop-print-packet/);
  });

  it("studio header and drawings print the compiled packet route, not the requested id", () => {
    const drawings = read("src/components/shop-drawings.tsx");
    const studio = read("src/components/studio-view.tsx");
    assert.match(studio, /packet\.route\.name/);
    assert.match(studio, /DoNotCutCallout/);
    assert.match(studio, /data-compile-route=\{packet\.route\.id\}/);
    assert.match(studio, /data-picker-selected=\{pickerSelected/);
    assert.match(studio, /data-compiled=\{compiled/);
    assert.match(drawings, /route\.name/);
    assert.match(drawings, /route\.joinery/);
    const headerLine =
      studio.split("\n").find((line) => line.includes("` · ${packet.route.name}`")) ??
      "";
    assert.match(headerLine, /packet\.route\.name/);
    assert.doesNotMatch(headerLine, /project\.routeId/);
  });
});
