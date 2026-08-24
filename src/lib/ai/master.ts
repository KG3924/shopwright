import { createServerFn } from "@tanstack/react-start";
import { compilePacket } from "../compile";
import { formatInches } from "../format";
import { cutHoldFromPacket, formatCutAxisSource, formatCutTriplet } from "../measure";
import type { ChatMessage, Project, Rank } from "../types";

type MasterInput = {
  question: string;
  project: Project;
  zip: string;
  rank: Rank;
  history: ChatMessage[];
};

export const askMaster = createServerFn({ method: "POST" })
  .validator((input: MasterInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "The Master Woodworker is unavailable here." };
    }
    if (data.question.length > 800) {
      return { ok: false as const, error: "Ask a shorter question." };
    }

    const packet = compilePacket(data.project, data.zip);
    const cutHold = cutHoldFromPacket(packet);
    const cuts = packet.cuts
      .map((c) => {
        const sources = (["length", "width", "thickness"] as const)
          .map((axis) => formatCutAxisSource(c, axis))
          .filter(Boolean)
          .join("; ");
        return `${c.letter}  ${c.qty}× ${c.name}: ${formatCutTriplet(c)}  from ${c.fromStock}${sources ? `  (${sources})` : ""}`;
      })
      .join("\n");

    const system = `You are the Master Woodworker inside Shopwright — a working furniture maker, not a chatbot. Speak plainly. Short paragraphs. No emoji. No markdown headings unless listing steps.

The builder is working from a shop packet. Lead with what to do. Use everyday words. If you need a shop term, use the beginner name in the same phrase and point at the lettered drawing — do not lecture. A photo can label a piece; it cannot authorize a cut list.

This is an INTERPRETATION of a piece, not a factory clone. If joinery was inferred, say so.

Current packet:
- Piece: ${data.project.name}
- Overall: ${formatInches(data.project.overall.w)} W × ${formatInches(data.project.overall.d)} D × ${formatInches(data.project.overall.h)} H
- Route: ${packet.route.name} (${packet.route.joinery})
- Species: ${packet.species.name}
- ZIP: ${data.zip}
- Board feet: ${packet.boardFeet.toFixed(1)} · ~${packet.weightLb} lb
${cutHold ? `- ${cutHold.text}\n` : ""}Cut list:
${cuts}

Lumber:
${packet.boards.map((b) => `${b.label} ${b.stock} — ${b.yields}`).join("\n")}

${
  packet.cuts.some((c) => c.locked.length || c.locked.width || c.locked.thickness)
    ? "Some parts are locked to custom sizes and will not follow overall W/D/H until unlocked."
    : "Unlocked parts follow overall W/D/H."
}

Species notes: ${packet.species.indoor} ${packet.species.stain} ${packet.species.weather}

Answer the builder's actual question. If they want a different size, tell them which parts move. If they want a different joint, compare routes. If something is unsafe with the tools on the bench, say so and offer a simpler method. Cap the answer at ~220 words.`;

    const history = data.history.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.4,
          max_tokens: 700,
          messages: [
            { role: "system", content: system },
            ...history,
            { role: "user", content: data.question },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: false as const, error: `xAI API error ${res.status}` };
      }
      const body = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      const text = body.choices[0]?.message.content?.trim() ?? "";
      if (!text) return { ok: false as const, error: "No answer came back." };
      return { ok: true as const, text };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "The bench is quiet. Try again.",
      };
    }
  });
