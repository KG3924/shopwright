import { createServerFn } from "@tanstack/react-start";
import { MAX_PHOTOS } from "../types";
import { INTERPRET_SYSTEM } from "./interpret-system";
import { hydrateVision, parseVisionJson, type InterpretInput } from "./hydrate";
import { mapInterpretHandlerError, photosForInterpret, resolveUrlSource } from "./url-source";

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
      temperature: 0.2,
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

export const interpretPiece = createServerFn({ method: "POST" })
  .validator((input: InterpretInput) => input)
  .handler(async ({ data }) => {
    try {
      if (!process.env.XAI_API_KEY) {
        return { ok: false as const, error: "AI is not available in this environment" };
      }
      let photos = collectPhotos(data);
      const userContent: unknown[] = [];
      let pageNote = "";

      if (data.kind === "url" && data.url) {
        try {
          const source = await resolveUrlSource(data.url);
          pageNote = source.pageNote;
          photos = photosForInterpret(photos, source.photoUrl);
        } catch (err) {
          return mapInterpretHandlerError(err, "Could not read that link");
        }
        if (photos.length === 0) {
          return {
            ok: false as const,
            error:
              "That page had no product photo we could use. Upload a picture of the piece — a small share-card crop is not enough to read a seat curve.",
          };
        }
      }

      if (photos.some((p) => p.length > 1_400_000)) {
        return { ok: false as const, error: "A photo is too large. Try a smaller image." };
      }

      photos.forEach((url, i) => {
        userContent.push({
          type: "image_url",
          image_url: { url, detail: i < 4 ? "high" : "low" },
        });
      });

      const prompt = [
        data.kind === "blueprint"
          ? "These are dimensioned plans. Prefer labeled measurements. Return MeasuredDim axes, instances, AND outlines that match the drawn profiles — including any curves."
          : photos.length > 1
            ? `These are ${photos.length} photographs of the same piece from different angles. Combine them. Photo 1 is primary; later photos are side, back, underside, detail, tape. Trace the REAL outline. If the seat is saddled, horseshoe, waterfall, or otherwise not a rectangle, sideOutline / planOutline / seatProfile MUST show that. Do not return a boxy stand-in.`
            : "This is a photograph of a piece of furniture. Trace the real outline. Return MeasuredDim parts, instances, and outlines for THIS piece. Do not replace curves with rectangles.",
        data.note
          ? `Builder note — treat as ground truth for details to look for: ${data.note}`
          : "Look for minor shaping: seat dish, waterfall/rolled front, leg taper and splay, back rake, crest/hoop, arm profile. Name seat profile, plan, front, leg style, and back style even on a small product-page crop.",
        pageNote,
        "Return JSON only. parts[] is required. Unknown axes must be value null, source unknown — do not invent typical stock.",
        "drawing.seatProfile, seatShape, seatFront, legStyle, backStyle, backProfile are required on a chair. sideOutline must follow the seat curve — a 4-point rectangle is a failed reading for a saddled or dished seat.",
        "If the piece looks metal or plastic, still return a wooden shop packet: solid/ply blanks, wood species, wood joinery. Note the source material. Do not refuse, and do not copy sheet-metal gauge as measured thickness.",
      ]
        .filter(Boolean)
        .join("\n");

      userContent.push({ type: "text", text: prompt });

      const text = await grokChat(
        [
          { role: "system", content: INTERPRET_SYSTEM },
          { role: "user", content: userContent },
        ],
        5000,
      );
      const ai = parseVisionJson(text);
      const project = hydrateVision(ai, data, photos);
      return { ok: true as const, project };
    } catch (err) {
      return mapInterpretHandlerError(err);
    }
  });
