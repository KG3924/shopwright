import type {
  Axis3,
  CutRow,
  Overall,
  PartInstance,
  PartRole,
} from "./types";
import { PART_ROLES } from "./types";

export type WorldBox = {
  id: string;
  letter: string;
  name: string;
  role: PartRole;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
};

export function isPartRole(value: string | undefined): value is PartRole {
  return !!value && (PART_ROLES as readonly string[]).includes(value);
}

export function inferRole(id: string, name: string): PartRole {
  const n = `${id} ${name}`.toLowerCase();
  if (/\bseat slat\b/.test(n) || /\bback slat\b/.test(n)) return "slat";
  if (/\blattice\b|\bstrip\b/.test(n)) return "slat";
  if (/\bseat\b/.test(n) && !/side/.test(n)) return "seat";
  if (/\btop\b/.test(n) && !/bottom|desktop/.test(n)) return "top";
  if (/\bleg\b/.test(n)) return "leg";
  if (/apron-l|long apron/.test(n)) return "apron-long";
  if (/apron-s|short apron/.test(n)) return "apron-short";
  if (/\bapron\b/.test(n)) return "apron";
  if (/\bstretcher\b/.test(n)) return "stretcher";
  if (/seat side/.test(n)) return "side";
  if (/\bside\b/.test(n)) return "side";
  if (/\bshelf\b/.test(n)) return "shelf";
  if (/\bbottom\b|\bweb\b/.test(n)) return "bottom";
  if (/\bstile\b/.test(n)) return "stile";
  if (/\brail\b/.test(n)) return "rail";
  if (/\bsplat\b/.test(n)) return "splat";
  if (/\bback\b/.test(n)) return "back";
  if (/\barm\b/.test(n) && !/brace/.test(n)) return "arm";
  if (/\bcleat\b/.test(n)) return "cleat";
  if (/\bdoor\b/.test(n)) return "door";
  if (/\bpost\b/.test(n)) return "post";
  if (/\broof\b|\btriangle\b|\bhip\b/.test(n)) return "roof";
  if (/\bbrace\b/.test(n)) return "brace";
  if (/\bkick\b/.test(n)) return "kick";
  if (/\bpanel\b/.test(n)) return "panel";
  return "other";
}

function defaultLengthAlong(role: PartRole): Axis3 {
  switch (role) {
    case "leg":
    case "stile":
    case "side":
    case "post":
    case "slat":
    case "splat":
    case "brace":
      return "z";
    case "apron-short":
      return "y";
    default:
      return "x";
  }
}

function defaultWidthAlong(role: PartRole): Axis3 {
  switch (role) {
    case "top":
    case "seat":
    case "shelf":
    case "bottom":
    case "roof":
    case "door":
    case "panel":
    case "side":
    case "arm":
      return "y";
    case "leg":
    case "post":
    case "slat":
    case "splat":
    case "stile":
      return "x";
    default:
      return "z";
  }
}

function worldSize(
  cut: CutRow,
  role: PartRole,
  inst?: PartInstance,
): { w: number; d: number; h: number } {
  let la: Axis3 = inst?.lengthAlong ?? defaultLengthAlong(role);
  let wa: Axis3 = inst?.widthAlong ?? defaultWidthAlong(role);
  if (la === wa) {
    la = defaultLengthAlong(role);
    wa = defaultWidthAlong(role);
    if (la === wa) {
      la = "x";
      wa = "y";
    }
  }
  const size: Record<Axis3, number> = { x: 0, y: 0, z: 0 };
  size[la] = cut.length;
  size[wa] = cut.width;
  const ta: Axis3 = la !== "x" && wa !== "x" ? "x" : la !== "y" && wa !== "y" ? "y" : "z";
  size[ta] = cut.thickness;
  return { w: size.x, d: size.y, h: size.z };
}

type Ctx = {
  topT: number;
  legW: number;
  sideT: number;
  seatH: number;
};

function contextFrom(cuts: CutRow[], overall: Overall, seatHeightRatio?: number): Ctx {
  const top = cuts.find((c) => {
    const r = c.role || inferRole(c.id, c.name);
    return r === "top" || r === "seat";
  });
  const leg = cuts.find((c) => (c.role || inferRole(c.id, c.name)) === "leg");
  const side = cuts.find((c) => (c.role || inferRole(c.id, c.name)) === "side");
  const ratio = seatHeightRatio ?? 0.48;
  return {
    topT: top?.thickness ?? 0.75,
    legW: Math.min(leg?.width ?? 1.5, overall.w / 6),
    sideT: side?.thickness ?? 0.75,
    seatH: overall.h * ratio,
  };
}

function clampPos(
  x: number,
  y: number,
  z: number,
  sz: { w: number; d: number; h: number },
  overall: Overall,
): { x: number; y: number; z: number } {
  return {
    x: Math.max(-sz.w * 0.5, Math.min(x, overall.w + sz.w * 0.5)),
    y: Math.max(-sz.d * 0.5, Math.min(y, overall.d + sz.d * 0.5)),
    z: Math.max(0, Math.min(z, overall.h + sz.h)),
  };
}

function inferPositions(
  cut: CutRow,
  role: PartRole,
  sz: { w: number; d: number; h: number },
  overall: Overall,
  ctx: Ctx,
): { x: number; y: number; z: number }[] {
  const { w: W, d: D, h: H } = overall;
  const qty = Math.max(1, Math.round(cut.qty) || 1);

  switch (role) {
    case "leg":
    case "post": {
      const corners = [
        { x: 0, y: 0, z: 0 },
        { x: Math.max(0, W - sz.w), y: 0, z: 0 },
        { x: 0, y: Math.max(0, D - sz.d), z: 0 },
        { x: Math.max(0, W - sz.w), y: Math.max(0, D - sz.d), z: 0 },
      ];
      return Array.from({ length: qty }, (_, i) => corners[i % 4]!);
    }
    case "top":
    case "seat":
      return [
        {
          x: Math.max(0, (W - sz.w) / 2),
          y: Math.max(0, (D - sz.d) / 2),
          z: Math.max(0, H - sz.h),
        },
      ];
    case "bottom":
      return [{ x: Math.max(0, (W - sz.w) / 2), y: 0, z: 0 }];
    case "side":
      if (qty >= 2) {
        return [
          { x: 0, y: 0, z: 0 },
          { x: Math.max(0, W - sz.w), y: 0, z: 0 },
        ];
      }
      return [{ x: 0, y: 0, z: 0 }];
    case "back":
      return [
        {
          x: Math.max(0, (W - sz.w) / 2),
          y: Math.max(0, D - sz.d),
          z: 0,
        },
      ];
    case "apron-long":
    case "stretcher": {
      const z = Math.max(0, H - ctx.topT - sz.h);
      const x = Math.min(ctx.legW, W / 4);
      return [
        { x, y: 0, z },
        { x, y: Math.max(0, D - sz.d), z },
      ].slice(0, qty);
    }
    case "apron-short": {
      const z = Math.max(0, H - ctx.topT - sz.h);
      const y = Math.min(ctx.legW, D / 4);
      return [
        { x: 0, y, z },
        { x: Math.max(0, W - sz.w), y, z },
      ].slice(0, qty);
    }
    case "apron": {
      const z = Math.max(0, H - ctx.topT - sz.h);
      const x = Math.min(ctx.legW, W / 4);
      const y = Math.min(ctx.legW, D / 4);
      const all = [
        { x, y: 0, z },
        { x, y: Math.max(0, D - sz.d), z },
        { x: 0, y, z },
        { x: Math.max(0, W - sz.w), y, z },
      ];
      return all.slice(0, qty);
    }
    case "shelf":
      return Array.from({ length: qty }, (_, i) => ({
        x: ctx.sideT,
        y: 0,
        z: ((i + 1) / (qty + 1)) * Math.max(H - sz.h, 1),
      }));
    case "slat": {
      const gap = Math.max(0.15, (W - qty * sz.w) / (qty + 1));
      const z0 = ctx.seatH;
      return Array.from({ length: qty }, (_, i) => ({
        x: gap + i * (sz.w + gap),
        y: Math.max(0, D - sz.d),
        z: z0,
      }));
    }
    case "stile":
      return [
        { x: 0, y: Math.max(0, D - sz.d), z: 0 },
        { x: Math.max(0, W - sz.w), y: Math.max(0, D - sz.d), z: 0 },
      ].slice(0, qty);
    case "rail": {
      const x = Math.min(ctx.legW, W / 4);
      return [
        { x, y: Math.max(0, D - sz.d), z: Math.max(0, H - sz.h) },
        { x, y: Math.max(0, D - sz.d), z: ctx.seatH },
      ].slice(0, qty);
    }
    case "splat":
      return [
        {
          x: Math.max(0, (W - sz.w) / 2),
          y: Math.max(0, D - sz.d),
          z: ctx.seatH,
        },
      ];
    case "arm":
      return [
        { x: 0, y: 0, z: ctx.seatH },
        { x: Math.max(0, W - sz.w), y: 0, z: ctx.seatH },
      ].slice(0, qty);
    case "door":
      return [{ x: 0, y: 0, z: 0 }];
    case "kick":
      return [{ x: ctx.sideT, y: 0, z: 0 }];
    case "cleat":
      return Array.from({ length: qty }, (_, i) => ({
        x: ctx.sideT,
        y: Math.max(0, D - sz.d),
        z: H * (0.55 + i * 0.12),
      }));
    case "roof":
      return [{ x: 0, y: 0, z: Math.max(0, H - sz.h) }];
    case "brace":
      return Array.from({ length: qty }, (_, i) => ({
        x: i % 2 === 0 ? 0 : Math.max(0, W - sz.w),
        y: D * 0.25,
        z: Math.max(0, ctx.seatH - sz.h),
      }));
    case "panel":
      return [
        {
          x: Math.max(0, (W - sz.w) / 2),
          y: Math.max(0, (D - sz.d) / 2),
          z: Math.max(0, (H - sz.h) / 2),
        },
      ];
    default:
      return Array.from({ length: qty }, (_, i) => ({
        x: (i % 3) * (sz.w + 0.4),
        y: D + 0.75 + Math.floor(i / 3) * (sz.d + 0.4),
        z: 0,
      }));
  }
}

function boxesForCut(
  cut: CutRow,
  overall: Overall,
  ctx: Ctx,
): WorldBox[] {
  const role = cut.role || inferRole(cut.id, cut.name);
  const given = cut.instances?.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
  );

  if (given && given.length) {
    const qty = Math.max(1, Math.round(cut.qty) || 1);
    const used =
      given.length >= qty
        ? given.slice(0, qty)
        : Array.from({ length: qty }, (_, i) => given[i % given.length]!);
    return used.map((inst, i) => {
      const sz = worldSize(cut, role, inst);
      const pos = clampPos(inst.x, inst.y, inst.z, sz, overall);
      return {
        id: `${cut.id}-${i}`,
        letter: cut.letter,
        name: cut.name,
        role,
        ...pos,
        ...sz,
      };
    });
  }

  const sz = worldSize(cut, role);
  return inferPositions(cut, role, sz, overall, ctx).map((pos, i) => {
    const p = clampPos(pos.x, pos.y, pos.z, sz, overall);
    return {
      id: `${cut.id}-${i}`,
      letter: cut.letter,
      name: cut.name,
      role,
      ...p,
      ...sz,
    };
  });
}

export function layoutBoxes(
  overall: Overall,
  cuts: CutRow[],
  opts: { explode?: number; seatHeightRatio?: number } = {},
): WorldBox[] {
  const ctx = contextFrom(cuts, overall, opts.seatHeightRatio);
  let boxes = cuts.flatMap((cut) => boxesForCut(cut, overall, ctx));
  const explode = opts.explode ?? 0;
  if (explode > 0 && boxes.length) {
    const cx = overall.w / 2;
    const cy = overall.d / 2;
    const cz = overall.h / 2;
    boxes = boxes.map((b) => {
      const bx = b.x + b.w / 2 - cx;
      const by = b.y + b.d / 2 - cy;
      const bz = b.z + b.h / 2 - cz;
      const m = Math.hypot(bx, by, bz) || 1;
      const f = explode / m;
      return { ...b, x: b.x + bx * f, y: b.y + by * f, z: b.z + bz * f };
    });
  }
  return boxes;
}
