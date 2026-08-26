/** Shared Shopwright vision brief — used by the interpret API and copy-paste bots. */
import { loadInterpretPrompt } from "./prompts";

export { loadInterpretPrompt, PROMPT_VARIANT_IDS, type PromptVariantId } from "./prompts";

/** Live interpret instructions: photo-truth. shop-form is the previous named variant. */
export const INTERPRET_SYSTEM = loadInterpretPrompt("photo-truth");
