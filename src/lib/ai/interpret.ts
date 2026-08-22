import { createServerFn } from "@tanstack/react-start";
import { getTemplate, matchTemplate } from "../catalog";
import { instantiate } from "../compile";
import { inferDrawing, isAdirondackReading, isUprightChair, mergeDrawing } from "../drawing";
import { inferRole, isPartRole } from "../layout";
import { inferDim } from "../parametric";
import type {
  Axis3,
  DrawingSpec,
  Overall,
  Part,
  PartInstance,
  Project,
  Rank,
} from "../types";
import { MAX_PHOTOS } from "../types";

type InterpretInput = {
  imageDataUrl?: string;
  imageDataUrls?: string[];
  url?: string;
  note?: string;
  kind: "photo" | "url" | "blueprint";
  rank: Rank;
};

type AiPart = {
  name: string;
  qty: number;
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  stock?: Part["stock"];
  role?: string;
  letter?: string;
  notes?: string;
  instances?: {
    x: number;
    y: number;
    z: number;
    lengthAlong?: string;
    widthAlong?: string;
  }[];
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
  parts?: AiPart[];
  drawing?: Partial<DrawingSpec>;
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

const SYSTEM = `You are Shopwright, a master furniture maker who reverse-engineers a piece from photographs into a shop-buildable interpretation — not a clone, and not a stock silhouette.

You may receive several photos of the SAME piece from different angles (front, side, back, underside, detail, a tape in frame). Use ALL of them.

The shop drawings are compiled from YOUR parts list. If you skip a board or invent a template instead of what is in the photo, the builder cuts the wrong wood. Always return the complete cut list for THIS piece.

Return ONLY JSON:
{
  "name": "short name of THIS piece",
  "category": "bench|table|case|bookcase|cabinet|chair|feeder|other",
  "templateId": "bench|console|bookcase|coffee-table|cabinet|adirondack|side-chair|feeder|null",
  "interpretation": "2-4 sentences: what you can see across the photos, what you are inferring",
  "confidence": 0.0-1.0,
  "overall": { "w": inches, "d": inches, "h": inches },
  "overallSource": "labeled|estimated|assumed",
  "speciesGuess": "maple|walnut|white-oak|red-oak|pine|cedar|poplar|plywood-oak",
  "uncertainties": ["what is still not visible"],
  "suggestedRouteId": "pocket|dado|mortise|dovetail|screwed|frame|dowel|adjustable|plugged",
  "parts": [
    {
      "name": "Top panel",
      "qty": 1,
      "lengthIn": 48,
      "widthIn": 14,
      "thicknessIn": 0.75,
      "stock": "solid",
      "role": "top",
      "notes": "optional",
      "instances": [
        { "x": 0, "y": 0, "z": 17.25, "lengthAlong": "x", "widthAlong": "y" }
      ]
    }
  ],
  "drawing": {
    "family": "table|case|chair|feeder",
    "backStyle": "lattice|x-back|splat|slat-fan|solid|none",
    "hasArms": false,
    "hasFootring": false,
    "seatShape": "square|round",
    "seatHeightRatio": 0.48,
    "reclined": false
  }
}

PARTS (required):
- Every board the shop will cut. Do not omit parts because a templateId exists. templateId only suggests joinery/hardware.
- Inches. Typical stock: 0.75, 0.5, 0.25, 1.5.
- role: top|seat|leg|apron-long|apron-short|side|shelf|bottom|back|rail|stile|splat|slat|arm|stretcher|cleat|door|panel|post|roof|brace|kick|other
- instances: one entry per copy. Origin is the front-left corner of the piece sitting on the floor. x = right, y = back (depth), z = up. The point is the part's front-left-bottom.
- lengthAlong / widthAlong: which world axis the board's LENGTH and WIDTH run ("x"|"y"|"z"). Thickness takes the remaining axis.
  Legs: lengthAlong z. Tops/seats/shelves: lengthAlong x, widthAlong y. Long aprons: lengthAlong x, widthAlong z. Case sides: lengthAlong z, widthAlong y.
- If a tape, ruler, or labeled dimension is in frame, those inches WIN (overallSource: labeled).

CHAIR CLASSIFICATION — common failure:
- Adirondack ONLY if reclined outdoor chair with a FAN of back slats and wide flat arms.
- Indoor dining / kitchen / counter / lattice / X-back / splat: templateId side-chair, reclined false.
- NEVER classify a lattice-back or X-back chair as an Adirondack.

Other rules:
- Interpretation, not factory clone. Hidden joinery is a route, not a fact.
- confidence < 0.7 if the underside or joinery is still not visible.`;

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

function pickTemplate(ai: AiJson) {
  if (isUprightChair(ai)) return getTemplate("side-chair");
  if (isAdirondackReading(ai)) return getTemplate("adirondack");
  return matchTemplate(ai.templateId ?? ai.category, ai.name);
}

function asAxis3(value: string | undefined): Axis3 | undefined {
  if (value === "x" || value === "y" || value === "z") return value;
  return undefined;
}

function mapInstances(
  raw: AiPart["instances"],
  from: Overall,
  to: Overall,
): PartInstance[] | undefined {
  if (!raw?.length) return undefined;
  const sx = to.w / (from.w || to.w);
  const sy = to.d / (from.d || to.d);
  const sz = to.h / (from.h || to.h);
  const mapped = raw
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
    .map((p) => ({
      x: p.x * sx,
      y: p.y * sy,
      z: p.z * sz,
      lengthAlong: asAxis3(p.lengthAlong),
      widthAlong: asAxis3(p.widthAlong),
    }));
  return mapped.length ? mapped : undefined;
}

function partsFromAi(ai: AiJson, overall: Overall): Part[] {
  const rawOverall = {
    w: ai.overall?.w ?? overall.w,
    d: ai.overall?.d ?? overall.d,
    h: ai.overall?.h ?? overall.h,
  };
  return (ai.parts ?? [])
    .filter(
      (p) =>
        p &&
        typeof p.name === "string" &&
        Number.isFinite(p.lengthIn) &&
        Number.isFinite(p.widthIn) &&
        Number.isFinite(p.thicknessIn),
    )
    .map((p, i) => {
      const name = p.name.trim() || `Part ${i + 1}`;
      const stock = (
        ["solid", "plywood", "hardwood-ply", "dowel", "sheet"] as const
      ).includes(p.stock as Part["stock"])
        ? (p.stock as Part["stock"])
        : "solid";
      return {
        id: `p${i}`,
        name,
        qty: Math.max(1, Math.round(p.qty) || 1),
        length: inferDim(name, "length", p.lengthIn, overall),
        width: inferDim(name, "width", p.widthIn, overall),
        thickness: inferDim(name, "thickness", p.thicknessIn, overall),
        stock,
        grain: "length" as const,
        notes: p.notes,
        role: isPartRole(p.role) ? p.role : inferRole(`p${i}`, name),
        instances: mapInstances(p.instances, rawOverall, overall),
        letter: p.letter?.slice(0, 3),
      };
    });
}

function hydrate(ai: AiJson, input: InterpretInput, photos: string[]): Project {
  const template = pickTemplate(ai);
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

  const drawing = mergeDrawing(
    template?.drawing ?? (template ? inferDrawing(template) : undefined),
    ai.drawing,
  );

  const aiParts = partsFromAi(ai, overall);
  const usePhotoParts = aiParts.length >= 2;

  const fallback =
    template ??
    (ai.category === "chair" || /chair|stool/i.test(ai.name ?? "")
      ? getTemplate("side-chair")
      : matchTemplate("bench", "bench"));

  const base = fallback ?? getTemplate("bench")!;

  return instantiate(
    {
      ...base,
      id: usePhotoParts ? `${base.id}-read` : base.id,
      name: ai.name ?? base.name,
      category: ai.category ?? base.category,
      blurb: usePhotoParts ? "Interpreted from photos." : base.blurb,
      overall,
      parts: usePhotoParts ? aiParts : base.parts,
      drawing,
      interpretation: ai.interpretation ?? base.interpretation,
      confidence: ai.confidence ?? base.confidence,
      uncertainties:
        ai.uncertainties && ai.uncertainties.length
          ? ai.uncertainties
          : base.uncertainties,
      buyBoards: usePhotoParts ? undefined : base.buyBoards,
      stack: usePhotoParts ? undefined : base.stack,
      stillBuy: usePhotoParts ? undefined : base.stillBuy,
      doNotBuy: usePhotoParts ? undefined : base.doNotBuy,
    },
    {
      overall,
      rank: input.rank,
      speciesId,
      photos,
      routeId:
        ai.suggestedRouteId && base.routes.some((r) => r.id === ai.suggestedRouteId)
          ? ai.suggestedRouteId
          : base.defaultRoute,
      overallSource: ai.overallSource ?? "estimated",
      sourceKind: input.kind,
      sourceLabel: input.url,
      interpretation: ai.interpretation ?? base.interpretation,
      confidence: clamp(ai.confidence ?? base.confidence, 0, 1),
      uncertainties:
        ai.uncertainties && ai.uncertainties.length
          ? ai.uncertainties
          : base.uncertainties,
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
          ? "These are dimensioned plans or blueprint scans. Prefer labeled measurements. Return the full parts list with instances so we can draw every board."
          : photos.length > 1
            ? `These are ${photos.length} photographs of the same piece from different angles. Combine them. Photo 1 is the primary view; later photos are additional angles (side, back, underside, detail, tape). Return a complete parts list with inches and 3D instances for THIS piece — not a stock template.`
            : "This is a photograph of a piece of furniture. Return a complete parts list with inches and 3D instances for THIS piece — not a stock silhouette.",
        data.note ? `Builder note: ${data.note}` : "",
        pageNote,
        "Return JSON only. parts[] is required.",
      ]
        .filter(Boolean)
        .join("\n");

      userContent.push({ type: "text", text: prompt });

      const text = await grokChat(
        [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        3500,
      );
      const ai = extractJson(text);
      if (!ai) {
        return { ok: false as const, error: "Could not parse an interpretation. Try another photo." };
      }
      const project = hydrate(ai, data, photos);
      if (project.parts.length >= 2 && project.parts[0]?.id.startsWith("p")) {
        project.partsFromPhotos = true;
      }
      return { ok: true as const, project };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Interpretation failed",
      };
    }
  });
