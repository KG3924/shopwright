import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectPhotos } from "../types";
import { hydrateVision, InterpretError, type AiJson, type InterpretInput } from "./hydrate";
import {
  INTERPRET_ABORT_MESSAGE,
  classifyFetchedUrl,
  filenameHintFromUrl,
  hasImageMagicBytes,
  isAbortError,
  isImageContentType,
  mapInterpretHandlerError,
  parseHtmlExcerpt,
  photosForInterpret,
  resolveUrlSource,
} from "./url-source";

const WAYFAIR_JPG =
  "https://assets.wfcdn.com/im/60244048/resize-h800-w800%5Ecompr-r85/2751/27514035/Arv+39%27%27+H+Solid+Wood+Side+Chair-694504592.jpg";

const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF_MAGIC = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP_MAGIC = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("isImageContentType", () => {
  it("accepts image/* including a parameter suffix", () => {
    assert.equal(isImageContentType("image/jpeg"), true);
    assert.equal(isImageContentType("IMAGE/PNG; charset=binary"), true);
    assert.equal(isImageContentType("image/webp"), true);
  });

  it("rejects HTML and empty headers", () => {
    assert.equal(isImageContentType("text/html; charset=utf-8"), false);
    assert.equal(isImageContentType(null), false);
    assert.equal(isImageContentType(""), false);
  });
});

describe("hasImageMagicBytes", () => {
  it("detects JPEG, PNG, GIF, and WebP", () => {
    assert.equal(hasImageMagicBytes(JPEG_MAGIC), true);
    assert.equal(hasImageMagicBytes(PNG_MAGIC), true);
    assert.equal(hasImageMagicBytes(GIF_MAGIC), true);
    assert.equal(hasImageMagicBytes(WEBP_MAGIC), true);
  });

  it("rejects HTML and empty buffers", () => {
    assert.equal(hasImageMagicBytes(new TextEncoder().encode("<!doctype html>")), false);
    assert.equal(hasImageMagicBytes(new Uint8Array()), false);
  });
});

describe("filenameHintFromUrl", () => {
  it("decodes the last path segment of a CDN image URL", () => {
    const hint = filenameHintFromUrl(WAYFAIR_JPG);
    assert.match(hint, /Solid Wood Side Chair/);
    assert.doesNotMatch(hint, /%27/);
    assert.doesNotMatch(hint, /\+/);
  });
});

describe("classifyFetchedUrl", () => {
  it("treats image/* as a photo URL and does not scrape HTML", () => {
    const jpegJunk = new Uint8Array([...JPEG_MAGIC, 0x00, 0xff, 0xd9]);
    const result = classifyFetchedUrl({
      url: WAYFAIR_JPG,
      contentType: "image/jpeg",
      body: jpegJunk,
    });
    assert.equal(result.kind, "image");
    assert.equal(result.photoUrl, WAYFAIR_JPG);
    assert.match(result.pageNote, /Side Chair/);
    assert.doesNotMatch(result.pageNote, /\u00ff|og:image|Excerpt:/);
  });

  it("falls back to magic bytes when Content-Type is missing or wrong", () => {
    const result = classifyFetchedUrl({
      url: WAYFAIR_JPG,
      contentType: "application/octet-stream",
      body: JPEG_MAGIC,
    });
    assert.equal(result.kind, "image");
    assert.equal(result.photoUrl, WAYFAIR_JPG);
  });

  it("keeps HTML pages on the og:image scrape path", () => {
    const html = `<!doctype html><html><head>
      <title>  Arhaus Slat Dining Chair </title>
      <meta property="og:image" content="https://cdn.example/chair-front.jpg">
    </head><body><p>Seven vertical slats, curved top rail, H-stretcher.</p></body></html>`;
    const result = classifyFetchedUrl({
      url: "https://shop.example/products/slat-chair",
      contentType: "text/html; charset=utf-8",
      body: new TextEncoder().encode(html),
    });
    assert.equal(result.kind, "html");
    assert.equal(result.photoUrl, "https://cdn.example/chair-front.jpg");
    assert.match(result.pageNote, /Arhaus Slat Dining Chair/);
    assert.match(result.pageNote, /Seven vertical slats/);
    assert.match(result.pageNote, /Excerpt:/);
  });
});

function urlOnlyBoards(): AiJson {
  return {
    name: "Vertical slat dining chair",
    category: "chair",
    templateId: "side-chair",
    interpretation: "Seven tall slats, curved top rail, H-stretcher.",
    confidence: 0.7,
    overall: { w: 18, d: 20, h: 39 },
    overallSource: "estimated",
    scaleConfidence: "low",
    parts: [
      {
        name: "Seat",
        qty: 1,
        length: { value: 18, source: "inferred", confidence: 0.5 },
        width: { value: 16, source: "inferred", confidence: 0.4 },
        thickness: { value: 0.75, source: "inferred", confidence: 0.3 },
        role: "seat",
      },
      {
        name: "Leg",
        qty: 4,
        length: { value: 17.25, source: "inferred", confidence: 0.5 },
        width: { value: 1.75, source: "inferred", confidence: 0.4 },
        thickness: { value: 1.75, source: "inferred", confidence: 0.4 },
        role: "leg",
      },
    ],
  };
}

describe("photosForInterpret", () => {
  it("puts a URL-only classified photo on the project photos list", () => {
    const classified = classifyFetchedUrl({
      url: WAYFAIR_JPG,
      contentType: "image/jpeg",
      body: JPEG_MAGIC,
    });
    const photos = photosForInterpret([], classified.photoUrl);
    assert.deepEqual(photos, [WAYFAIR_JPG]);

    const input: InterpretInput = { kind: "url", rank: "beginner", url: WAYFAIR_JPG };
    const project = hydrateVision(urlOnlyBoards(), input, photos);
    assert.deepEqual(project.photos, [WAYFAIR_JPG]);
    assert.equal(project.photoDataUrl, WAYFAIR_JPG);
    assert.deepEqual(projectPhotos(project), [WAYFAIR_JPG]);
    assert.doesNotMatch(projectPhotos(project)[0] ?? "", /catalog|lattice-chair/);
  });

  it("does not replace uploaded photos with the classified URL", () => {
    const uploaded = ["data:image/jpeg;base64,abc"];
    assert.deepEqual(photosForInterpret(uploaded, WAYFAIR_JPG), uploaded);
  });
});

describe("parseHtmlExcerpt", () => {
  it("reads reversed og:image attribute order", () => {
    const html =
      `<html><head><title>Chair</title>` +
      `<meta content="https://cdn.example/og.jpg" property="og:image"></head></html>`;
    const excerpt = parseHtmlExcerpt(html, "https://shop.example/chair");
    assert.equal(excerpt.image, "https://cdn.example/og.jpg");
    assert.equal(excerpt.title, "Chair");
  });
});

describe("resolveUrlSource", () => {
  it("uses the request URL as the photo and skips HTML scrape for image/*", async () => {
    let textReads = 0;
    let bufferReads = 0;
    const fetchImpl: typeof fetch = async () => {
      const res = new Response(JPEG_MAGIC, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
      const originalText = res.text.bind(res);
      const originalBuffer = res.arrayBuffer.bind(res);
      res.text = async () => {
        textReads += 1;
        return originalText();
      };
      res.arrayBuffer = async () => {
        bufferReads += 1;
        return originalBuffer();
      };
      return res;
    };
    const source = await resolveUrlSource(WAYFAIR_JPG, fetchImpl);
    assert.equal(source.kind, "image");
    assert.equal(source.photoUrl, WAYFAIR_JPG);
    assert.equal(textReads, 0);
    assert.equal(bufferReads, 0);
    assert.doesNotMatch(source.pageNote, /Excerpt:/);
  });

  it("still extracts og:image from a real HTML product page", async () => {
    const html = `<html><head><title>Product</title>
      <meta property="og:image" content="https://cdn.example/og.jpg"></head>
      <body>Vertical slat dining chair</body></html>`;
    const fetchImpl: typeof fetch = async () =>
      new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
    const source = await resolveUrlSource("https://shop.example/chair", fetchImpl);
    assert.equal(source.kind, "html");
    assert.equal(source.photoUrl, "https://cdn.example/og.jpg");
    assert.match(source.pageNote, /Vertical slat dining chair/);
  });
});

describe("mapInterpretHandlerError", () => {
  it("maps AbortError and DOMException AbortError to a friendly message", () => {
    const named = new Error("This operation was aborted");
    named.name = "AbortError";
    assert.equal(isAbortError(named), true);
    assert.equal(mapInterpretHandlerError(named).error, INTERPRET_ABORT_MESSAGE);
    assert.equal(mapInterpretHandlerError(named).ok, false);
    assert.equal(mapInterpretHandlerError(named).code, undefined);

    const dom = new DOMException("The operation was aborted.", "AbortError");
    assert.equal(isAbortError(dom), true);
    assert.equal(mapInterpretHandlerError(dom).error, INTERPRET_ABORT_MESSAGE);
  });

  it("maps Node AbortSignal.timeout TimeoutError the same way", () => {
    const timeout = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    );
    assert.equal(isAbortError(timeout), true);
    assert.equal(mapInterpretHandlerError(timeout).error, INTERPRET_ABORT_MESSAGE);

    const wrapped = new Error("fetch failed");
    wrapped.cause = timeout;
    assert.equal(isAbortError(wrapped), true);
    assert.equal(mapInterpretHandlerError(wrapped).error, INTERPRET_ABORT_MESSAGE);
  });

  it("keeps incomplete_parts honesty instead of swallowing Cut A", () => {
    const err = new InterpretError(
      "incomplete_parts",
      "Could not build a cut list from the photos. We will not fall back to template parts.",
    );
    const mapped = mapInterpretHandlerError(err);
    assert.equal(mapped.ok, false);
    assert.equal(mapped.code, "incomplete_parts");
    assert.match(mapped.error, /will not fall back to template parts/);
  });
});
