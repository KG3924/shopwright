import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { installRandomUuidPolyfill, randomUuid } from "./random-uuid";
import { newPieceId } from "./saved-pieces";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function withCryptoMethod<K extends keyof Crypto>(
  name: K,
  value: Crypto[K] | undefined,
  run: () => void,
): void {
  const cryptoObj = globalThis.crypto;
  const hadOwn = Object.prototype.hasOwnProperty.call(cryptoObj, name);
  const previous = hadOwn
    ? Object.getOwnPropertyDescriptor(cryptoObj, name)
    : undefined;
  Object.defineProperty(cryptoObj, name, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
  try {
    run();
  } finally {
    if (hadOwn && previous) {
      Object.defineProperty(cryptoObj, name, previous);
    } else {
      delete (cryptoObj as unknown as Record<string, unknown>)[name as string];
    }
  }
}

describe("random UUID helper / polyfill", () => {
  it("returns a UUID-shaped string when crypto.randomUUID is absent", () => {
    withCryptoMethod("randomUUID", undefined, () => {
      assert.equal(typeof globalThis.crypto.randomUUID, "undefined");
      const id = randomUuid();
      assert.match(id, UUID_V4);
      assert.notEqual(id, randomUuid());
    });
  });

  it("falls back without getRandomValues and still returns a UUID-shaped string", () => {
    withCryptoMethod("randomUUID", undefined, () => {
      withCryptoMethod("getRandomValues", undefined, () => {
        const id = randomUuid();
        assert.match(id, UUID_V4);
      });
    });
  });

  it("installs crypto.randomUUID when missing so packet ids work on HTTP LAN", () => {
    withCryptoMethod("randomUUID", undefined, () => {
      assert.equal(typeof globalThis.crypto.randomUUID, "undefined");
      installRandomUuidPolyfill();
      assert.equal(typeof globalThis.crypto.randomUUID, "function");
      assert.match(globalThis.crypto.randomUUID(), UUID_V4);
      assert.match(newPieceId(), UUID_V4);
    });
  });

  it("is imported at app boot before store / interpret code", () => {
    const router = readFileSync(join(root, "src/router.tsx"), "utf8");
    const firstImport = router.match(/^import\s+[^;]+;/m)?.[0] ?? "";
    assert.match(firstImport, /random-uuid/);
  });
});
