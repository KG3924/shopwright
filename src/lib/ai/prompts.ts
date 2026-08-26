import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

export const PROMPT_VARIANT_IDS = ["photo-truth", "shop-form"] as const;
export type PromptVariantId = (typeof PROMPT_VARIANT_IDS)[number];

/** Load a named interpret instruction variant. Default live path is photo-truth. */
export function loadInterpretPrompt(variant: PromptVariantId = "photo-truth"): string {
  return readFileSync(join(dir, "prompts", `${variant}.md`), "utf8").trim();
}
