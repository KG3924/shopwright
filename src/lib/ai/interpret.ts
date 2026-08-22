import { createServerFn } from "@tanstack/react-start";
import { matchTemplate } from "../catalog";
import { instantiate } from "../compile";
import { inferDim } from "../parametric";
import type { Overall, Part, Project, Rank } from "../types";
import { MAX_PHOTOS } from "../types";

type InterpretInput = {
  imageDataUrl?: string;
  imageDataUrls?: string[];
  url?: string;
  note?: string;
  kind: "photo" | "url" | "blueprint";
  rank: Rank;
};

type AiJson = {
  name?: string;
  category?: string;
  templateId?: string;
  interpretation?: string;
  confidence?: number;
  overall?: Overall;
  overallSource?: "labeled" | "estimated" | "assumed";
  speciesGuess?: string;
  uncertainties?: string[];
  suggestedRouteId?: string;
  parts?: {
    name: string;
    qty: number;
    lengthIn: number;
    widthIn: number;
    thicknessIn: number;
    stock?: Part["stock"];
  }[];
};

function extractJson(text: string): AiJson | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as AiJson;
  } catch {
    return null;
  }
}

const SYSTEM = `You are Shopwright, a master furniture maker who reverse-engineers pieces into shop-buildable interpretations — not clones.

You may receive several photos of the SAME piece from different angles (front, side, back, underside, detail, a tape in frame). Use ALL of them. Extra angles of joinery or the underside should raise confidence and shrink the uncertainty list.

Return ONLY JSON with this shape:
{
  "name": "short name",
  "category": "bench|table|case|bookcase|cabinet|chair|other",
  "templateId": "bench|console|bookcase|coffee-table|cabinet|adirondack|null",
  "interpretation": "2-4 sentences: what it is, what you can see across the photos, what you are inferring",
  "confidence": 0.0-1.0,
  "overall": { "w": inches, "d": inches, "h": inches },
  "overallSource": "labeled|estimated|assumed",
  "speciesGuess": "maple|walnut|white-oak|red-oak|pine|cedar|poplar|plywood-oak",
  "uncertainties": ["what is still not visible after all photos"],
  "suggestedRouteId": "pocket|dado|mortise|dovetail|screwed|frame|dowel|adjustable|plugged",
  "parts": optional array if it does NOT match a templateId. Each: {name, qty, lengthIn, widthIn, thicknessIn, stock}
}

Rules:
- This is an INTERPRETATION a competent shop would build, not a factory reproduction.
- If dimensions are labeled on a blueprint or product graphic, use them (overallSource: labeled).
- If a tape, ruler, or known object is in frame, prefer that scale.
- Call out hidden construction. Never invent cam-locks or exact factory joinery as fact.
- Prefer templateId when the piece is clearly a bench, console/credenza/nightstand, bookcase, coffee table, wall cabinet, or Adirondack.
- Inches, not mm. Typical stock: 0.75, 0.5, 0.25, 1.5.
- confidence < 0.7 if you still cannot see the underside or joinery after every photo.`;

async function grokChat(messages: unknown[], maxTokens: number): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("AI is not available in this environment");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`xAI API error ${res.status}${t ? `: ${t.slice(0, 180)}` : ""}`);
  }
  const body = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return body.choices[0]?.message.content ?? "";
}

function hydrate(ai: AiJson, input: InterpretInput, photos: string[]): Project {
  const template = matchTemplate(ai.templateId ?? ai.category, ai.name);
  const overall: Overall = {
    w: clamp(ai.overall?.w ?? template?.overall.w ?? 36, 8, 120),
    d: clamp(ai.overall?.d ?? template?.overall.d ?? 16, 6, 60),
    h: clamp(ai.overall?.h ?? template?.overall.h ?? 30, 6, 96),
  };

  const speciesId =
    ai.speciesGuess &&
    [
      "maple",
      "walnut",
      "white-oak",
      "red-oak",
      "pine",
      "cedar",
      "poplar",
      "plywood-oak",
    ].includes(ai.speciesGuess)
      ? ai.speciesGuess
      : (template?.defaultSpecies ?? "maple");

  if (template) {
    return instantiate(template, {
      overall,
      rank: input.rank,
      speciesId,
      photos,
      routeId: ai.suggestedRouteId && template.routes.some((r) => r.id === ai.suggestedRouteId)
        ? ai.suggestedRouteId
        : template.defaultRoute,
      overallSource: ai.overallSource ?? "estimated",
      sourceKind: input.kind,
      sourceLabel: input.url,
      interpretation: ai.interpretation ?? template.interpretation,
      confidence: clamp(ai.confidence ?? template.confidence, 0, 1),
      uncertainties:
        ai.uncertainties && ai.uncertainties.length
          ? ai.uncertainties
          : template.uncertainties,
    });
  }

  const fallback = matchTemplate("bench", "bench")!;
  const parts: Part[] = (ai.parts ?? []).map((p, i) => ({
    id: `p${i}`,
    name: p.name,
    qty: p.qty || 1,
    length: inferDim(p.name, "length", p.lengthIn, overall),
    width: inferDim(p.name, "width", p.widthIn, overall),
    thickness: inferDim(p.name, "thickness", p.thicknessIn, overall),
    stock: p.stock ?? "solid",
    grain: "length" as const,
  }));

  return instantiate(
    {
      ...fallback,
      id: "custom",
      name: ai.name ?? "Interpreted piece",
      category: ai.category ?? "other",
      blurb: "Interpreted from photos.",
      image: "",
      overall,
      parts: parts.length ? parts : fallback.parts,
      interpretation: ai.interpretation ?? "Interpreted from the photos.",
      confidence: ai.confidence ?? 0.55,
      uncertainties: ai.uncertainties ?? [
        "Custom interpretation — verify every dimension.",
      ],
    },
    {
      overall,
      rank: input.rank,
      speciesId,
      photos,
      overallSource: ai.overallSource ?? "estimated",
      sourceKind: input.kind,
      sourceLabel: input.url,
    },
  );
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function collectPhotos(data: InterpretInput): string[] {
  const list = [
    ...(data.imageDataUrls ?? []),
    ...(data.imageDataUrl ? [data.imageDataUrl] : []),
  ].filter(Boolean);
  return [...new Set(list)].slice(0, MAX_PHOTOS);
}

async function fetchUrlExcerpt(url: string): Promise<{ title: string; text: string; image?: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Shopwright/0.1 (interpretation; +https://github.com/KG3924/shopwright)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Could not read that page (${res.status})`);
  const html = (await res.text()).slice(0, 80_000);
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ??
    url;
  const ogImage =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 4000);
  return { title, text, image: ogImage };
}

export const interpretPiece = createServerFn({ method: "POST" })
  .validator((input: InterpretInput) => input)
  .handler(async ({ data }) => {
    try {
      if (!process.env.XAI_API_KEY) {
        return { ok: false as const, error: "AI is not available in this environment" };
      }
      const photos = collectPhotos(data);
      if (photos.some((p) => p.length > 1_400_000)) {
        return { ok: false as const, error: "A photo is too large. Try a smaller image." };
      }

      const userContent: unknown[] = [];
      let pageNote = "";

      if (data.kind === "url" && data.url) {
        try {
          const page = await fetchUrlExcerpt(data.url);
          pageNote = `Product page title: ${page.title}\nExcerpt: ${page.text}`;
          if (page.image && photos.length === 0) {
            userContent.push({
              type: "image_url",
              image_url: { url: page.image, detail: "high" },
            });
          }
        } catch (err) {
          return {
            ok: false as const,
            error: err instanceof Error ? err.message : "Could not read that link",
          };
        }
      }

      photos.forEach((url, i) => {
        userContent.push({
          type: "image_url",
          image_url: { url, detail: i < 3 ? "high" : "low" },
        });
      });

      const prompt = [
        data.kind === "blueprint"
          ? "These are dimensioned plans or blueprint scans. Prefer labeled measurements."
          : photos.length > 1
            ? `These are ${photos.length} photographs of the same piece from different angles. Combine them. Photo 1 is the primary view; later photos are additional angles (side, back, underside, detail, tape).`
            : "This is a photograph of a piece of furniture. Interpret a shop-buildable version.",
        data.note ? `Builder note: ${data.note}` : "",
        pageNote,
        "Return JSON only.",
      ]
        .filter(Boolean)
        .join("\n");

      userContent.push({ type: "text", text: prompt });

      const text = await grokChat(
        [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        1800,
      );
      const ai = extractJson(text);
      if (!ai) {
        return { ok: false as const, error: "Could not parse an interpretation. Try another photo." };
      }
      const project = hydrate(ai, data, photos);
      return { ok: true as const, project };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Interpretation failed",
      };
    }
  });
