import { createServerFn } from "@tanstack/react-start";
import { MAX_PHOTOS } from "../types";
import { hydrateVision, InterpretError, parseVisionJson, type InterpretInput } from "./hydrate";

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
  "scaleConfidence": "high|low|conflict",
  "scaleNotes": ["optional notes about tape, labels, or disagreeing sizes"],
  "speciesGuess": "maple|walnut|white-oak|red-oak|pine|cedar|poplar|plywood-oak",
  "uncertainties": ["what is still not visible"],
  "suggestedRouteId": "pocket|dado|mortise|dovetail|screwed|frame|dowel|adjustable|plugged",
  "parts": [
    {
      "name": "Top panel",
      "qty": 1,
      "length": { "value": 48, "source": "measured", "confidence": 0.9, "photoIndex": 0 },
      "width": { "value": 14, "source": "inferred", "confidence": 0.5 },
      "thickness": { "value": null, "source": "unknown", "confidence": 0, "note": "edge not visible" },
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

MEASUREMENT RULES (required):
- Every axis is a MeasuredDim: value (inches or null), source (measured|inferred|unknown), confidence 0–1.
- measured = tape, ruler, or labeled dimension in frame. inferred = proportion from a known size. unknown = you cannot see it — value MUST be null.
- Do NOT invent typical stock thickness (0.75, 0.5, 1.5) as if it were measured. If the edge is not visible, thickness.source is unknown.
- If two labeled sizes disagree, scaleConfidence is conflict and explain in scaleNotes.
- If a tape or labeled dimension is in frame, those inches WIN (overallSource: labeled, scaleConfidence: high).
- overall is required unless every board has instances that reconstruct the box.

PARTS (required):
- Every board the shop will cut. Do not omit parts because a templateId exists. templateId only suggests joinery/hardware.
- role: top|seat|leg|apron-long|apron-short|side|shelf|bottom|back|rail|stile|splat|slat|arm|stretcher|cleat|door|panel|post|roof|brace|kick|other
- instances: one entry per copy. Origin is the front-left corner of the piece sitting on the floor. x = right, y = back (depth), z = up. The point is the part's front-left-bottom.
- lengthAlong / widthAlong: which world axis the board's LENGTH and WIDTH run ("x"|"y"|"z"). Thickness takes the remaining axis.
  Legs: lengthAlong z. Tops/seats/shelves: lengthAlong x, widthAlong y. Long aprons: lengthAlong x, widthAlong z. Case sides: lengthAlong z, widthAlong y.

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
          ? "These are dimensioned plans or blueprint scans. Prefer labeled measurements. Return the full parts list with MeasuredDim axes and instances so we can draw every board."
          : photos.length > 1
            ? `These are ${photos.length} photographs of the same piece from different angles. Combine them. Photo 1 is the primary view; later photos are additional angles (side, back, underside, detail, tape). Return a complete parts list with MeasuredDim inches and 3D instances for THIS piece — not a stock template.`
            : "This is a photograph of a piece of furniture. Return a complete parts list with MeasuredDim inches and 3D instances for THIS piece — not a stock silhouette.",
        data.note ? `Builder note: ${data.note}` : "",
        pageNote,
        "Return JSON only. parts[] is required. Unknown axes must be value null, source unknown — do not invent typical stock.",
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
      const ai = parseVisionJson(text);
      const project = hydrateVision(ai, data, photos);
      return { ok: true as const, project };
    } catch (err) {
      if (err instanceof InterpretError) {
        return { ok: false as const, error: err.message, code: err.code };
      }
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Interpretation failed",
      };
    }
  });
