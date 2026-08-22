import type { Rank, Technique } from "./types";
import { rankIndex } from "./format";

export const TECHNIQUES: Technique[] = [
  {
    id: "square-cut",
    name: "Cut square, then trust the cut",
    autoUntil: "novice",
    tools: ["Speed square", "circular or miter saw", "pencil"],
    body: "Mark with a knife or a sharp pencil against a square. Cut on the waste side of the line. Check the first offcut with the square before you commit the rest of the stack. If the saw isn't square to the shoe, every joint after this fights you.",
    safety: "Wait for the blade to stop before lifting a circular saw. Support the offcut so it doesn't pinch.",
  },
  {
    id: "pocket-hole",
    name: "Pocket-hole joinery",
    autoUntil: "novice",
    tools: ["Kreg jig", "step bit", "square-drive bit", "clamps"],
    body: "Set the jig and bit collar to the actual thickness — measure, don't assume ¾. Clamp the work so the jig can't walk. Glue the joint, then drive fine-thread screws into hardwood, coarse-thread into pine and plywood. Two screws per joint for aprons; three on a wide rail.",
    safety: "Clamp. A spinning workpiece around a drill is how beginners get hurt on this step.",
  },
  {
    id: "glue-up",
    name: "Panel glue-up",
    autoUntil: "apprentice",
    tools: ["Bar clamps", "cauls", "Titebond", "damp rag"],
    body: "Joint the edges so they kiss with no daylight. Alternate the cups if you can see them. Dry-clamp first. Glue both edges, rub them, then clamp just until a thin even bead rises. Cauls keep the panel flat. Wait, then scrape the bead — don't sand wet glue into the pores.",
  },
  {
    id: "clamp-up",
    name: "Carcase clamp-up",
    autoUntil: "beginner",
    tools: ["Parallel clamps", "square", "winding sticks or a true rod"],
    body: "Glue is not a gap-filler. Dry-fit until the diagonals match. Then glue, clamp, and re-check diagonals before you walk away. A 1/16 of rack in a bench becomes a rocker for life.",
  },
  {
    id: "dado",
    name: "Cutting dados",
    autoUntil: "apprentice",
    tools: ["Table saw + stack dado, or router + guide"],
    body: "A dado should match the actual shelf thickness, not the nominal ¾. Plywood is often 23/32. Sneak up on the fit — the shelf should slide with hand pressure, not a mallet. Stopped dados hide the joint on a finished side; through dados are faster and honest on shop furniture.",
    safety: "Never dado with a standard blade buried in two passes unless you know the riving knife is still on. A stack dado or a router is the right tool.",
  },
  {
    id: "mortise-tenon",
    name: "Mortise and tenon",
    autoUntil: "craftsman",
    tools: ["Mortising chisel or hollow chisel", "tenon saw", "marking gauge"],
    body: "Layout from a face side and face edge so everything references the same faces. Mortise first, tenon to fit. Cheeks should be parallel; shoulders should land together. A haunch on apron tenons keeps the top of the mortise from blowing out.",
  },
  {
    id: "dovetail",
    name: "Dovetailed drawers",
    autoUntil: "craftsman",
    tools: ["Dovetail saw", "chisels", "marking gauge", "or a router jig"],
    body: "Pins or tails first is religion; tails first is common in the US. Scribe deep, saw to the line, chop the waste from both sides. The joint should close with a firm push. Glue sparingly — squeeze-out in the pins is misery.",
  },
  {
    id: "taper-leg",
    name: "Tapering legs",
    autoUntil: "apprentice",
    tools: ["Taper jig or bandsaw", "hand plane"],
    body: "Leave the top 3–4 inches full thickness so aprons have a landing. Taper two inside faces for a mid-century look. Cut all four legs with the same jig. Mark the waste clearly — reversing a taper on leg 4 is a classic way to buy more walnut.",
  },
  {
    id: "drawer-slides",
    name: "Installing drawer slides",
    autoUntil: "apprentice",
    tools: ["Side-mount or undermount slides", "square", "spacer blocks"],
    body: "Build the box 1\" narrower than the opening for standard side-mount ½\" slides (that's ½\" per side). Use a spacer block so both slides sit at the same height. Install the cabinet members first, square to the case front. Then the box. If it binds, it's almost never the slide — it's a racked carcase.",
  },
  {
    id: "finish-oil",
    name: "Oil finish",
    autoUntil: "novice",
    tools: ["Sandpaper to 180 or 220", "wiping oil", "lint-free cloth"],
    body: "Sand through the grits without skipping. Raise the grain with a damp cloth, knock it back. Wipe oil on, wait 10–15 minutes, wipe all of it off. Repeat the next day. Three coats is a piece; six is furniture. Dispose of oily rags in a water-filled can — they self-heat.",
    safety: "Oily rags can spontaneously combust. Water can, lid on, outside.",
  },
  {
    id: "resaw",
    name: "Resaw a 1-by into clapboard",
    autoUntil: "apprentice",
    tools: ["Table saw", "thin-kerf blade", "tall fence", "push stick", "featherboard"],
    body: "Do not stand the 1×12 on edge. Rip first, board flat, fence at finished slat width. Then resaw each strip on edge against a tall fence — two passes that meet in the middle, same face on the fence both times. A ¾\" strip minus an ⅛\" kerf split in half is about 5/16\". That is the look. If the kerfs don't meet, raise 1/16\" and go again. A paper-thin web in the middle is fine — snap it and plane the resawn face. Do not force a cut that wants to kick back.",
    safety: "Unplug to screw a 6–8\" tall scrap of plywood to the fence. Riving knife ON. No loose offcut. Slow.",
  },
  {
    id: "hip-cleat",
    name: "Hip cleat inside a plywood pyramid",
    autoUntil: "apprentice",
    tools: ["Tape", "drill", "#6 screws", "sander or saw"],
    body: "Two pieces of ½\" plywood cannot pass through each other. At each hip the edges just push together. A hairline gap is fine. Copper and the wooden hip cap cover the outside. The ¾×¾ cleat inside is what actually holds it. Tape the pyramid, flip it, nest a cleat in the valley. If it rocks, knock one corner off until it sits on both inner faces. Four screws per hip, staggered, two through each triangle into the cleat.",
  },
  {
    id: "finish-paint",
    name: "Painted casework",
    autoUntil: "novice",
    tools: ["Primer", "enamel or milk paint", "220 sanding sponge"],
    body: "Poplar and pine want primer. Fill plywood edges. Sand between coats. Milk paint on a Shaker cabinet is period-correct and repairable; a waterborne enamel is tougher on a kitchen piece.",
  },
  {
    id: "outdoor-finish",
    name: "Outdoor finish",
    autoUntil: "novice",
    tools: ["Stainless fasteners", "penetrating oil or spar urethane", "mask"],
    body: "Cedar and white oak can live outside. Film finishes crack in Texas sun; penetrating oils are easier to renew. Gap slats so water doesn't sit. Raise the piece on feet, not a flat slab.",
  },
  {
    id: "wood-movement",
    name: "Wood movement",
    autoUntil: "craftsman",
    tools: ["Figure-8 fasteners or Z-clips", "oversized holes"],
    body: "A 48\" white-oak top can move ¼\" across the grain from August in Allen to January A/C. Screw the top at the front, slot it at the back. Never glue a solid top all the way around an apron.",
  },
  {
    id: "edge-banding",
    name: "Edge-banding plywood",
    autoUntil: "novice",
    tools: ["Iron-on banding or solid lipping", "trimmer", "block plane"],
    body: "Iron-on veneer banding is the beginner path. Overhang a hair, trim flush, sand 220, then finish the edge with the face so they color together. Solid-wood lipping is the craftsman path and takes a beating.",
  },
];

export function techniquesFor(ids: string[], rank: Rank): Technique[] {
  const want = new Set(ids);
  return TECHNIQUES.filter((t) => {
    if (!want.has(t.id)) return false;
    return rankIndex(rank) <= rankIndex(t.autoUntil);
  });
}

export function getTechnique(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}
