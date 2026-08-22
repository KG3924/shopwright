import { InterpretError, type InterpretErrorCode } from "./hydrate";

const FETCH_UA = "Shopwright/0.1 (interpretation; +https://github.com/KG3924/shopwright)";
const HTML_EXCERPT_BYTES = 80_000;
const HTML_TEXT_CHARS = 4000;

export const INTERPRET_ABORT_MESSAGE =
  "Interpretation was cancelled or timed out. Try again.";

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

export function filenameHintFromUrl(url: string): string {
  let last = "";
  try {
    last = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    last = url.split("/").filter(Boolean).at(-1) ?? "";
  }
  try {
    return decodeURIComponent(last.replace(/\+/g, " ")).trim();
  } catch {
    return last.replace(/\+/g, " ").trim();
  }
}

function imagePageNote(url: string): string {
  const hint = filenameHintFromUrl(url);
  return hint ? `Image filename: ${hint}` : "";
}

export function parseHtmlExcerpt(
  html: string,
  fallbackTitle: string,
): { title: string; text: string; image?: string } {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ??
    fallbackTitle;
  const ogImage =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, HTML_TEXT_CHARS);
  return { title, text, image: ogImage };
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
  return {
    kind: "html",
    photoUrl: excerpt.image,
    title: excerpt.title,
    text: excerpt.text,
    pageNote: `Product page title: ${excerpt.title}\nExcerpt: ${excerpt.text}`,
  };
}

export async function resolveUrlSource(
  url: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ClassifiedUrl> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": FETCH_UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Could not read that page (${res.status})`);
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

export function isAbortError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "name" in err && err.name === "AbortError");
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
  return {
    ok: false,
    error: err instanceof Error ? err.message : fallback,
  };
}
