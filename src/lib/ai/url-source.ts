import { MAX_PHOTOS } from "../types";
import { InterpretError, type InterpretErrorCode } from "./hydrate";

const FETCH_UA = "Shopwright/0.1 (interpretation; +https://github.com/KG3924/shopwright)";
const HTML_EXCERPT_BYTES = 220_000;
const HTML_TEXT_CHARS = 4000;

export const PAGE_BLOCKED_MESSAGE =
  "That product page blocked the fetch. Upload a photo of the piece, or paste a direct image URL (wfcdn .jpg), not the product-page link.";
export const PAGE_UNREADABLE_MESSAGE = "Could not read that page.";
export const NO_PRODUCT_PHOTO_MESSAGE =
  "That page had no product photo we could use. Upload a picture of the piece.";
export const INTERPRET_ABORT_MESSAGE =
  "Interpretation was cancelled or timed out. Try again.";

const BLOCKED_FETCH_STATUSES = new Set([401, 403, 429]);

/** 401/403/429 are the site blocking us, not a Shopwright bug. */
export function messageForFetchStatus(status: number): string {
  return BLOCKED_FETCH_STATUSES.has(status) ? PAGE_BLOCKED_MESSAGE : PAGE_UNREADABLE_MESSAGE;
}

function httpStatusFromCouldNotRead(message: string): number | undefined {
  const m = /^Could not read that page \((\d+)\)$/.exec(message);
  if (!m) return undefined;
  const status = Number(m[1]);
  return Number.isFinite(status) ? status : undefined;
}

export type ClassifiedUrl =
  | { kind: "image"; photoUrl: string; pageNote: string }
  | { kind: "html"; photoUrl?: string; title: string; text: string; pageNote: string };

export function isImageContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime.startsWith("image/");
}

export function hasImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return true;
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return true;
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true;
  }
  return false;
}

const MAX_FILENAME_HINT = 200;

export function filenameHintFromUrl(url: string): string {
  let last = "";
  try {
    last = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    last = url.split("/").filter(Boolean).at(-1) ?? "";
  }
  let hint: string;
  try {
    hint = decodeURIComponent(last.replace(/\+/g, " ")).trim();
  } catch {
    hint = last.replace(/\+/g, " ").trim();
  }
  return hint.slice(0, MAX_FILENAME_HINT);
}

function imagePageNote(url: string): string {
  const hint = filenameHintFromUrl(url);
  return hint ? `Image filename: ${hint}` : "";
}

function metaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    html.match(new RegExp(`property=["']${escaped}["'][^>]*content=["']([^"']+)`, "i"))?.[1] ??
    html.match(new RegExp(`content=["']([^"']+)["'][^>]*property=["']${escaped}["']`, "i"))?.[1] ??
    html.match(new RegExp(`name=["']${escaped}["'][^>]*content=["']([^"']+)`, "i"))?.[1] ??
    html.match(new RegExp(`content=["']([^"']+)["'][^>]*name=["']${escaped}["']`, "i"))?.[1]
  );
}

function isJunkImageUrl(url: string): boolean {
  return /logo|sprite|pixel|1x1|favicon|icon[_-]|placeholder|blank\.(gif|png)|badge|wordmark/i.test(
    url,
  );
}

/** Bump tiny Wayfair/CDN share crops so vision can see a seat dish. */
export function preferReadableProductImage(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(
      /resize-h(\d+)-w(\d+)/i,
      (_m, h: string, w: string) => {
        const nh = Number(h);
        const nw = Number(w);
        if (!Number.isFinite(nh) || !Number.isFinite(nw)) return _m;
        if (nh >= 800 && nw >= 800) return _m;
        return "resize-h800-w800";
      },
    );
    u.pathname = path;
    return u.toString();
  } catch {
    return url;
  }
}

function imageScore(url: string): number {
  const m = url.match(/resize-h(\d+)-w(\d+)/i);
  if (m) return Number(m[1]) * Number(m[2]);
  if (/\/im\//.test(url) && /wfcdn|wayfair/.test(url)) return 500_000;
  return url.length;
}

export function collectProductImages(html: string): string[] {
  const meta: string[] = [];
  const jsonLd: string[] = [];
  const extra: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined, into: string[]) => {
    if (!raw) return;
    const trimmed = raw.trim().replace(/&amp;/g, "&");
    if (!/^https?:\/\//i.test(trimmed)) return;
    if (isJunkImageUrl(trimmed)) return;
    const sized = preferReadableProductImage(trimmed);
    if (seen.has(sized)) return;
    seen.add(sized);
    into.push(sized);
  };

  push(metaContent(html, "og:image"), meta);
  push(metaContent(html, "og:image:url"), meta);
  push(metaContent(html, "og:image:secure_url"), meta);
  push(metaContent(html, "twitter:image"), meta);
  push(metaContent(html, "twitter:image:src"), meta);
  push(html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)/i)?.[1], meta);

  for (const m of html.matchAll(/"image"\s*:\s*"?(https?:\/\/[^"\s,]+)/gi)) {
    push(m[1], jsonLd);
  }
  if (meta.length) return meta;
  if (jsonLd.length) return jsonLd.sort((a, b) => imageScore(b) - imageScore(a));
  for (const m of html.matchAll(/"(https?:\/\/[^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)) {
    push(m[1], extra);
  }
  return extra.sort((a, b) => imageScore(b) - imageScore(a));
}

export function pageLooksBlocked(title: string, text: string): boolean {
  return /access to this page has been denied|px-captcha|\bcaptcha\b|are you a human|press & hold to confirm/i.test(
    `${title} ${text}`,
  );
}

export function parseHtmlExcerpt(
  html: string,
  fallbackTitle: string,
): { title: string; text: string; image?: string } {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ??
    fallbackTitle;
  const images = collectProductImages(html);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, HTML_TEXT_CHARS);
  return { title, text, image: images[0] };
}

export function classifyFetchedUrl(input: {
  url: string;
  contentType: string | null | undefined;
  body: Uint8Array;
}): ClassifiedUrl {
  if (isImageContentType(input.contentType) || hasImageMagicBytes(input.body)) {
    return {
      kind: "image",
      photoUrl: input.url,
      pageNote: imagePageNote(input.url),
    };
  }
  const clipped =
    input.body.byteLength > HTML_EXCERPT_BYTES
      ? input.body.subarray(0, HTML_EXCERPT_BYTES)
      : input.body;
  const html = new TextDecoder("utf-8", { fatal: false }).decode(clipped);
  const excerpt = parseHtmlExcerpt(html, input.url);
  if (pageLooksBlocked(excerpt.title, excerpt.text)) {
    throw new Error(PAGE_BLOCKED_MESSAGE);
  }
  if (!excerpt.image) {
    throw new Error(NO_PRODUCT_PHOTO_MESSAGE);
  }
  return {
    kind: "html",
    photoUrl: excerpt.image,
    title: excerpt.title,
    text: excerpt.text,
    pageNote: `Product page title: ${excerpt.title}\nExcerpt: ${excerpt.text}`,
  };
}

/** Uploads win. If none, keep the classified CDN / og:image URL on the project. */
export function photosForInterpret(
  uploaded: string[],
  sourcePhotoUrl?: string,
): string[] {
  if (uploaded.length) return uploaded.slice(0, MAX_PHOTOS);
  if (sourcePhotoUrl) return [sourcePhotoUrl];
  return [];
}

export async function resolveUrlSource(
  url: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ClassifiedUrl> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": FETCH_UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(messageForFetchStatus(res.status));
  const contentType = res.headers.get("content-type");
  if (isImageContentType(contentType)) {
    try {
      await res.body?.cancel();
    } catch {
      // Unused image bodies can already be closed in some runtimes.
    }
    return classifyFetchedUrl({ url, contentType, body: new Uint8Array() });
  }
  const raw = new Uint8Array(await res.arrayBuffer());
  return classifyFetchedUrl({ url, contentType, body: raw });
}

function errorName(err: unknown): string | undefined {
  if (err && typeof err === "object" && "name" in err && typeof err.name === "string") {
    return err.name;
  }
  return undefined;
}

/** Client disconnect is AbortError; AbortSignal.timeout() is TimeoutError on Node 22. */
export function isAbortError(err: unknown): boolean {
  const names = [errorName(err)];
  if (err && typeof err === "object" && "cause" in err) {
    names.push(errorName(err.cause));
  }
  return names.some((name) => name === "AbortError" || name === "TimeoutError");
}

export function mapInterpretHandlerError(
  err: unknown,
  fallback = "Interpretation failed",
): { ok: false; error: string; code?: InterpretErrorCode } {
  if (isAbortError(err)) {
    return { ok: false, error: INTERPRET_ABORT_MESSAGE };
  }
  if (err instanceof InterpretError) {
    return { ok: false, error: err.message, code: err.code };
  }
  const raw = err instanceof Error ? err.message : fallback;
  const status = httpStatusFromCouldNotRead(raw);
  return {
    ok: false,
    error: status !== undefined ? messageForFetchStatus(status) : raw,
  };
}
