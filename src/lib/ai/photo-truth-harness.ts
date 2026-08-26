import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadInterpretPrompt, type PromptVariantId } from "./prompts";

const dir = dirname(fileURLToPath(import.meta.url));

/**
 * Catalog joinery / finish leaks that must not appear in photo-truth
 * interpret JSON. Bare "paint" is allowed in "not a paint finish".
 */
export const INTERPRET_LEAK_RE =
  /\blattice\b|half-?laps?|\bdiamonds?\b|23-ga|\benamel\b|\bprimer\b|paint the seat|paint-grade|Paint A|tenon horns?/i;

export type PromptScore = {
  variant: PromptVariantId;
  score: number;
  missingRequired: string[];
};

const PHOTO_TRUTH_REQUIRED: { id: string; re: RegExp }[] = [
  { id: "backStyle-enum", re: /lattice\|splat\|solid\|crest\|none\|unknown/ },
  { id: "seat", re: /solid\|upholstered\|unknown/ },
  { id: "finish", re: /paint\|clear\|unknown/ },
  { id: "do-not-invent", re: /DO NOT INVENT/i },
  { id: "templateId-not-joinery", re: /templateId is NOT a joinery source/i },
  { id: "unknown-axis", re: /Unreadable axis|source unknown/i },
  { id: "no-catalog-joinery-in-json", re: /JSON MUST include/ },
];

function promptForbidsSuggestedRoute(prompt: string): boolean {
  return !/"suggestedRouteId"/.test(prompt);
}

export function scorePromptVariant(variant: PromptVariantId): PromptScore {
  const prompt = loadInterpretPrompt(variant);
  const missingRequired: string[] = [];
  let score = 0;
  for (const rule of PHOTO_TRUTH_REQUIRED) {
    if (rule.re.test(prompt)) score += 1;
    else missingRequired.push(rule.id);
  }
  if (promptForbidsSuggestedRoute(prompt)) score += 1;
  else missingRequired.push("no-suggestedRouteId");
  return { variant, score, missingRequired };
}

export function comparePromptVariants(): {
  winner: "photo-truth" | "shop-form" | "tie";
  photoTruth: PromptScore;
  shopForm: PromptScore;
} {
  const photoTruth = scorePromptVariant("photo-truth");
  const shopForm = scorePromptVariant("shop-form");
  const winner =
    photoTruth.score > shopForm.score
      ? "photo-truth"
      : shopForm.score > photoTruth.score
        ? "shop-form"
        : "tie";
  return { winner, photoTruth, shopForm };
}

export function jsonLeakHits(ai: unknown): string[] {
  const blob = JSON.stringify(ai);
  const hits: string[] = [];
  const re = new RegExp(INTERPRET_LEAK_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(blob))) {
    hits.push(match[0]);
  }
  return hits;
}

export function assertPhotoTruthJson(ai: unknown): void {
  if (!ai || typeof ai !== "object" || Array.isArray(ai)) {
    throw new Error("interpret JSON must be an object");
  }
  const rec = ai as Record<string, unknown>;
  const drawing = rec.drawing;
  const backStyle =
    drawing && typeof drawing === "object" && !Array.isArray(drawing)
      ? (drawing as { backStyle?: unknown }).backStyle
      : undefined;
  if (backStyle === "lattice") {
    throw new Error("photo-truth JSON must not tag lattice on a Barros-class chair");
  }
  if (rec.seat !== "solid" && rec.seat !== "upholstered" && rec.seat !== "unknown") {
    throw new Error('photo-truth JSON must include seat: solid|upholstered|unknown');
  }
  if (rec.finish !== "paint" && rec.finish !== "clear" && rec.finish !== "unknown") {
    throw new Error('photo-truth JSON must include finish: paint|clear|unknown');
  }
  const hits = jsonLeakHits(ai);
  if (hits.length) {
    throw new Error(`photo-truth JSON leaked catalog joinery/finish: ${hits.join(", ")}`);
  }
  const keys = Object.keys(rec);
  for (const banned of ["routes", "hardware", "steps"]) {
    if (keys.includes(banned)) {
      throw new Error(`photo-truth JSON must not include ${banned}`);
    }
  }
}

export function loadFrozenBarrosAi(): Record<string, unknown> {
  const raw = JSON.parse(
    readFileSync(join(dir, "fixtures", "barros-side-chair.json"), "utf8"),
  ) as { ai: Record<string, unknown> };
  return raw.ai;
}
