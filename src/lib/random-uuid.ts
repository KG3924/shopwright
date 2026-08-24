/**
 * UUID helper for piece / packet ids.
 *
 * `crypto.randomUUID` is secure-context-only. iOS Safari on HTTP LAN
 * (http://<lan-ip>:port) therefore has `crypto` but `randomUUID === undefined`.
 * `crypto.getRandomValues` still works there; we polyfill `randomUUID` from it
 * at app boot so interpret / save never require HTTPS.
 */

function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidFromMathRandom(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = (Math.random() * 256) | 0;
  return uuidFromBytes(bytes);
}

/** v4 UUID that never calls `crypto.randomUUID` (safe to install as the polyfill). */
function generateUuid(): `${string}-${string}-${string}-${string}-${string}` {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return uuidFromBytes(bytes) as `${string}-${string}-${string}-${string}-${string}`;
  }
  return uuidFromMathRandom() as `${string}-${string}-${string}-${string}-${string}`;
}

export function randomUuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // Some engines expose the method but throw outside a secure context.
    }
  }
  return generateUuid();
}

export function installRandomUuidPolyfill(): void {
  const c = globalThis.crypto;
  if (!c || typeof c.randomUUID === "function") return;
  try {
    Object.defineProperty(c, "randomUUID", {
      value: generateUuid,
      configurable: true,
      writable: true,
    });
  } catch {
    try {
      c.randomUUID = generateUuid;
    } catch {
      // Frozen Crypto; `randomUuid()` still works for our ids.
    }
  }
}

installRandomUuidPolyfill();
