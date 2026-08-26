import { type ReactNode } from "react";
import { drawingCaption } from "@/lib/drawing";
import { formatInches } from "@/lib/format";
import { SHOP_PLAIN } from "@/lib/plain-copy";
import type { CutRow, DrawingSpec, ShopPacket } from "@/lib/types";

const INK = "var(--color-ink)";
const PAPER = "var(--color-paper)";
const WOOD = "var(--color-paper-2)";
const WOOD_DK = "color-mix(in oklab, var(--color-ink) 18%, var(--color-paper-2))";

function findCut(cuts: CutRow[], re: RegExp): CutRow | undefined {
  return cuts.find((c) => re.test(c.id) || re.test(c.name));
}

function Frame({
  label,
  worldW,
  worldH,
  xName,
  yName,
  children,
}: {
  label: string;
  worldW: number;
  worldH: number;
  xName: string;
  yName: string;
  children: (s: number, ox: number, oy: number) => ReactNode;
}) {
  const padX = 14;
  const padY = 16;
  const innerW = 100 - padX * 2;
  const innerH = 78 - padY;
  const s = Math.min(innerW / Math.max(worldW, 1), innerH / Math.max(worldH, 1));
  const dw = worldW * s;
  const dh = worldH * s;
  const ox = (100 - dw) / 2;
  const oy = 6 + (78 - dh) / 2;
  return (
    <figure>
      <svg viewBox="0 0 100 100" className="h-auto w-full" aria-hidden>
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          fill={PAPER}
          stroke={INK}
          strokeWidth="0.6"
        />
        {children(s, ox, oy)}
        <path
          d={`M ${ox} ${oy + dh + 6} L ${ox + dw} ${oy + dh + 6}`}
          stroke={INK}
          strokeWidth="0.55"
        />
        <path
          d={`M ${ox - 6} ${oy} L ${ox - 6} ${oy + dh}`}
          stroke={INK}
          strokeWidth="0.55"
        />
        <text
          x={ox + dw / 2}
          y={oy + dh + 12}
          textAnchor="middle"
          fontSize="5.4"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
        >
          {xName} {formatInches(worldW)}
        </text>
        <text
          x={ox - 8.5}
          y={oy + dh / 2}
          textAnchor="middle"
          fontSize="5.4"
          fill={INK}
          fontFamily="IBM Plex Mono, monospace"
          transform={`rotate(-90 ${ox - 8.5} ${oy + dh / 2})`}
        >
          {yName} {formatInches(worldH)}
        </text>
      </svg>
      <figcaption className="mt-1 text-center font-mono text-xs text-ink-soft">
        {label}
      </figcaption>
    </figure>
  );
}

function geom(packet: ShopPacket, spec: DrawingSpec) {
  const { w, d, h } = packet.project.overall;
  const cuts = packet.cuts;
  const front = findCut(cuts, /front leg/i);
  const back = findCut(cuts, /back leg|stile/i);
  const seat = findCut(cuts, /^seat$|\bseat\b/i);
  const stretcher = findCut(cuts, /front stretcher|footring/i) ?? findCut(cuts, /stretcher/i);
  const topRail = findCut(cuts, /top (back )?rail|crest/i);
  const botRail = findCut(cuts, /bottom (back )?rail/i);
  const slats = findCut(cuts, /back slat/i);
  const arm = findCut(cuts, /\barm\b/i);
  const ratio = spec.seatHeightRatio ?? 0.5;
  const seatH = front ? front.length + (seat?.thickness ?? 0.75) : h * ratio;
  const legW = Math.min(
    front?.width ?? back?.width ?? 1.75,
    Math.min(w, d) / 7,
  );
  return {
    w,
    d,
    h,
    cuts,
    front,
    back,
    seat,
    stretcher,
    topRail,
    botRail,
    slats,
    arm,
    seatH: Math.min(Math.max(seatH, h * 0.28), h * 0.82),
    seatT: seat?.thickness ?? 0.75,
    legW,
    stretcherH: stretcher?.width ?? 1.75,
    topRailH: topRail?.width ?? 2.5,
    botRailH: botRail?.width ?? 2,
    hasArms: spec.hasArms ?? Boolean(arm),
    hasFootring: spec.hasFootring ?? true,
    backStyle: spec.backStyle ?? "none",
    seatShape: spec.seatShape ?? "square",
    reclined: spec.reclined ?? false,
  };
}

function BackFill({
  x,
  y,
  w,
  h,
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  style: DrawingSpec["backStyle"];
}) {
  if (w < 1 || h < 1) return null;
  if (style === "x-back") {
    return (
      <g fill="none" stroke={INK} strokeWidth="0.85">
        <path d={`M ${x} ${y} L ${x + w} ${y + h}`} />
        <path d={`M ${x + w} ${y} L ${x} ${y + h}`} />
      </g>
    );
  }
  if (style === "splat") {
    const cx = x + w / 2;
    return (
      <path
        d={`M ${cx - w * 0.08} ${y + h} L ${cx - w * 0.12} ${y + h * 0.55} C ${cx - w * 0.28} ${y + h * 0.35}, ${cx - w * 0.22} ${y + 2}, ${cx} ${y} C ${cx + w * 0.22} ${y + 2}, ${cx + w * 0.28} ${y + h * 0.35}, ${cx + w * 0.12} ${y + h * 0.55} L ${cx + w * 0.08} ${y + h} Z`}
        fill={WOOD_DK}
        stroke={INK}
        strokeWidth="0.7"
      />
    );
  }
  if (style === "slat-fan") {
    const n = 5;
    const slatW = w / (n + 1.5);
    const gap = (w - n * slatW) / (n + 1);
    return (
      <g>
        {Array.from({ length: n }, (_, i) => (
          <rect
            key={i}
            x={x + gap + i * (slatW + gap)}
            y={y}
            width={slatW}
            height={h}
            fill={WOOD}
            stroke={INK}
            strokeWidth="0.5"
          />
        ))}
      </g>
    );
  }
  if (style === "solid" || style === "crest") {
    return (
      <rect x={x} y={y} width={w} height={h} fill={WOOD} stroke={INK} strokeWidth="0.5" />
    );
  }
  if (style !== "lattice") return null;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g fill="none" stroke={INK} strokeWidth="0.7">
      <rect x={x} y={y} width={w} height={h} fill={PAPER} />
      <path d={`M ${x} ${y} L ${x + w} ${y + h}`} />
      <path d={`M ${x + w} ${y} L ${x} ${y + h}`} />
      <path d={`M ${x} ${cy} L ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} Z`} />
      <path d={`M ${x + w * 0.22} ${y} L ${x + w} ${y + h * 0.72}`} />
      <path d={`M ${x + w * 0.78} ${y} L ${x} ${y + h * 0.72}`} />
      <path d={`M ${x} ${y + h * 0.28} L ${x + w * 0.78} ${y + h}`} />
      <path d={`M ${x + w} ${y + h * 0.28} L ${x + w * 0.22} ${y + h}`} />
    </g>
  );
}

function UprightSide({ packet, spec }: { packet: ShopPacket; spec: DrawingSpec }) {
  const g = geom(packet, spec);
  return (
    <Frame label="Side" worldW={g.d} worldH={g.h} xName="D" yName="H">
      {(s, ox, oy) => {
        const dw = g.d * s;
        const dh = g.h * s;
        const leg = Math.max(g.legW * s, 3.1);
        const seatT = Math.max(g.seatT * s, 2.2);
        const seatTop = oy + (g.h - g.seatH) * s;
        const floor = oy + dh;
        const rake = spec.reclined ? 0 : dw * 0.04;
        const backTopX = ox;
        const backBotX = ox + rake;
        const frontX = ox + dw - leg;
        const strH = Math.max(g.stretcherH * s, 2.6);
        const strY = floor - (g.seatH * 0.38) * s;
        const railTop = Math.max(g.topRailH * s, 3.2);
        const railBot = Math.max(g.botRailH * s, 2.6);
        const backDepth = leg * 0.85;
        return (
          <g>
            {/* back stile */}
            <path
              d={`M ${backTopX} ${oy} L ${backTopX + leg} ${oy} L ${backBotX + leg} ${floor} L ${backBotX} ${floor} Z`}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.75"
            />
            {/* front leg */}
            <rect
              x={frontX}
              y={seatTop + seatT}
              width={leg}
              height={floor - (seatTop + seatT)}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.75"
            />
            {/* side stretcher / footring */}
            <rect
              x={backBotX + leg}
              y={strY}
              width={frontX - (backBotX + leg)}
              height={strH}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.7"
            />
            {/* seat — square, horizontal */}
            <rect
              x={backBotX}
              y={seatTop}
              width={dw - rake}
              height={seatT}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.8"
            />
            {/* top rail, seen on edge */}
            <rect
              x={backTopX}
              y={oy}
              width={backDepth + 1.4}
              height={railTop}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.65"
            />
            {/* bottom rail just above the seat */}
            <rect
              x={backTopX}
              y={seatTop - railBot}
              width={backDepth + 1.2}
              height={railBot}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.65"
            />
            {g.hasArms ? (
              <rect
                x={backTopX + leg * 0.4}
                y={seatTop - dh * 0.18}
                width={dw * 0.72}
                height={Math.max(1.6, 0.75 * s * 1.4)}
                fill={WOOD_DK}
                stroke={INK}
                strokeWidth="0.65"
              />
            ) : null}
          </g>
        );
      }}
    </Frame>
  );
}

function UprightFront({ packet, spec }: { packet: ShopPacket; spec: DrawingSpec }) {
  const g = geom(packet, spec);
  return (
    <Frame label="Front" worldW={g.w} worldH={g.h} xName="W" yName="H">
      {(s, ox, oy) => {
        const dw = g.w * s;
        const dh = g.h * s;
        const leg = Math.max(g.legW * s, 3.1);
        const seatT = Math.max(g.seatT * s, 2.2);
        const seatTop = oy + (g.h - g.seatH) * s;
        const floor = oy + dh;
        const railTop = Math.max(g.topRailH * s, 3.2);
        const railBot = Math.max(g.botRailH * s, 2.6);
        const strH = Math.max(g.stretcherH * s, 2.6);
        const strY = floor - (g.seatH * 0.38) * s;
        const openX = ox + leg;
        const openY = oy + railTop;
        const openW = dw - 2 * leg;
        const openH = seatTop - railBot - openY;
        return (
          <g>
            <BackFill x={openX} y={openY} w={openW} h={Math.max(openH, 4)} style={g.backStyle} />
            {/* back stiles — full height, drawn over lattice horns */}
            <rect x={ox} y={oy} width={leg} height={dh} fill={WOOD} stroke={INK} strokeWidth="0.75" />
            <rect
              x={ox + dw - leg}
              y={oy}
              width={leg}
              height={dh}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.75"
            />
            <rect
              x={ox}
              y={oy}
              width={dw}
              height={railTop}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.7"
            />
            <rect
              x={ox + leg}
              y={seatTop - railBot}
              width={openW}
              height={railBot}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.7"
            />
            {/* seat */}
            <rect
              x={ox}
              y={seatTop}
              width={dw}
              height={seatT}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.8"
            />
            {/* front legs in front of the stiles below the seat */}
            <rect
              x={ox}
              y={seatTop + seatT}
              width={leg}
              height={floor - seatTop - seatT}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.75"
            />
            <rect
              x={ox + dw - leg}
              y={seatTop + seatT}
              width={leg}
              height={floor - seatTop - seatT}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.75"
            />
            {/* footring */}
            <rect
              x={ox + leg}
              y={strY}
              width={dw - 2 * leg}
              height={strH}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.7"
            />
          </g>
        );
      }}
    </Frame>
  );
}

function ReclinedSide({ packet }: { packet: ShopPacket }) {
  const { d, h } = packet.project.overall;
  return (
    <Frame label="Side" worldW={d} worldH={h} xName="D" yName="H">
      {(s, ox, oy) => {
        const dw = d * s;
        const dh = h * s;
        const seatY = oy + dh * 0.55;
        const seatX = ox + dw * 0.12;
        const backX = ox + dw * 0.72;
        return (
          <g fill={WOOD} stroke={INK} strokeWidth="0.7">
            <path
              d={`M ${seatX} ${oy + dh} L ${seatX + dw * 0.08} ${seatY} L ${backX} ${seatY + dh * 0.08} L ${backX - dw * 0.06} ${oy + dh} Z`}
            />
            <rect x={seatX + dw * 0.02} y={oy + dh * 0.22} width={dw * 0.08} height={dh * 0.78} />
            <path
              d={`M ${backX - dw * 0.04} ${oy + dh * 0.08} L ${backX + dw * 0.08} ${oy} L ${backX + dw * 0.16} ${oy + dh * 0.06} L ${backX + dw * 0.04} ${oy + dh * 0.16} Z`}
            />
            <rect x={seatX} y={seatY} width={dw * 0.62} height={dh * 0.06} fill={WOOD_DK} />
            <rect
              x={seatX + dw * 0.02}
              y={oy + dh * 0.22}
              width={dw * 0.55}
              height={dh * 0.05}
              fill={WOOD_DK}
            />
          </g>
        );
      }}
    </Frame>
  );
}

function ReclinedFront({ packet }: { packet: ShopPacket }) {
  const { w, h } = packet.project.overall;
  const slats = findCut(packet.cuts, /back slat/i);
  const n = slats?.qty ?? 7;
  const arm = findCut(packet.cuts, /arm/i);
  return (
    <Frame label="Front" worldW={w} worldH={h} xName="W" yName="H">
      {(s, ox, oy) => {
        const dw = w * s;
        const dh = h * s;
        const slatW = dw / (n + 3);
        const gap = slatW * 0.25;
        const slatsEl = [];
        for (let i = 0; i < n; i++) {
          const x = ox + dw * 0.18 + i * (slatW + gap);
          const extra = Math.sin((i / Math.max(n - 1, 1)) * Math.PI) * dh * 0.08;
          slatsEl.push(
            <rect
              key={i}
              x={x}
              y={oy + dh * 0.06 - extra}
              width={slatW}
              height={dh * 0.55 + extra}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.5"
            />,
          );
        }
        return (
          <g>
            {slatsEl}
            <rect
              x={ox}
              y={oy + dh * 0.22}
              width={dw}
              height={(arm?.thickness ?? 0.75) * s * 1.6}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.6"
            />
            <rect
              x={ox + dw * 0.08}
              y={oy + dh * 0.55}
              width={dw * 0.84}
              height={dh * 0.08}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.6"
            />
            <rect
              x={ox + dw * 0.08}
              y={oy + dh * 0.55}
              width={dw * 0.08}
              height={dh * 0.45}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.6"
            />
            <rect
              x={ox + dw * 0.84}
              y={oy + dh * 0.55}
              width={dw * 0.08}
              height={dh * 0.45}
              fill={WOOD}
              stroke={INK}
              strokeWidth="0.6"
            />
          </g>
        );
      }}
    </Frame>
  );
}

function ChairPlan({ packet, spec }: { packet: ShopPacket; spec: DrawingSpec }) {
  const g = geom(packet, spec);
  return (
    <Frame label="Plan (top)" worldW={g.w} worldH={g.d} xName="W" yName="D">
      {(s, ox, oy) => {
        const dw = g.w * s;
        const dd = g.d * s;
        const leg = Math.max(g.legW * s, 3.4);
        const rail = Math.max(0.75 * s, 2);
        return (
          <g>
            {g.seatShape === "round" ? (
              <ellipse
                cx={ox + dw / 2}
                cy={oy + dd / 2}
                rx={dw * 0.46}
                ry={dd * 0.42}
                fill={WOOD}
                stroke={INK}
                strokeWidth="0.8"
              />
            ) : (
              <rect
                x={ox}
                y={oy}
                width={dw}
                height={dd}
                fill={WOOD}
                stroke={INK}
                strokeWidth="0.8"
              />
            )}
            <rect x={ox} y={oy} width={leg} height={leg} fill={WOOD_DK} stroke={INK} strokeWidth="0.55" />
            <rect
              x={ox + dw - leg}
              y={oy}
              width={leg}
              height={leg}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.55"
            />
            <rect
              x={ox}
              y={oy + dd - leg}
              width={leg}
              height={leg}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.55"
            />
            <rect
              x={ox + dw - leg}
              y={oy + dd - leg}
              width={leg}
              height={leg}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.55"
            />
            {/* back rail at the rear of the plan */}
            <rect
              x={ox + leg}
              y={oy}
              width={dw - 2 * leg}
              height={rail}
              fill={WOOD_DK}
              stroke={INK}
              strokeWidth="0.5"
            />
          </g>
        );
      }}
    </Frame>
  );
}

export function ChairElevations({
  packet,
  spec,
}: {
  packet: ShopPacket;
  spec: DrawingSpec;
}) {
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
        Drawn as {drawingCaption(spec)}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {spec.reclined ? (
          <>
            <ReclinedSide packet={packet} />
            <ReclinedFront packet={packet} />
          </>
        ) : (
          <>
            <UprightSide packet={packet} spec={spec} />
            <UprightFront packet={packet} spec={spec} />
          </>
        )}
        <ChairPlan packet={packet} spec={spec} />
      </div>
    </div>
  );
}

export function chairExplodedBoxes(
  packet: ShopPacket,
  spec: DrawingSpec,
): {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  mark?: string;
}[] {
  const g = geom(packet, spec);
  const letter = (row?: CutRow) => row?.letter;
  if (spec.reclined) {
    const { w, d, h } = g;
    const exp = Math.max(w, d, h) * 0.18;
    const slatN = Math.min(g.slats?.qty ?? 7, 7);
    const slatW = (g.slats?.width ?? 3.5) * 0.35;
    const boxes = [
      {
        x: -exp,
        y: 0,
        z: 0,
        w: 1.2,
        d: d * 0.7,
        h: 7,
        mark: letter(findCut(g.cuts, /seat side|side \(pattern\)/i)),
      },
      { x: w + exp * 0.2, y: 0, z: 0, w: 1.2, d: d * 0.7, h: 7 },
      {
        x: 2,
        y: -exp,
        z: 0,
        w: 3.5,
        d: 0.75,
        h: 20,
        mark: letter(g.front),
      },
      {
        x: 2,
        y: d + exp * 0.3,
        z: 0,
        w: 5.5,
        d: 0.75,
        h: 28,
        mark: letter(g.back),
      },
      {
        x: -2,
        y: d * 0.2,
        z: h * 0.45,
        w: w + 4,
        d: 5.5,
        h: 0.75,
        mark: letter(g.arm),
      },
    ];
    for (let i = 0; i < slatN; i++) {
      boxes.push({
        x: (i / Math.max(slatN - 1, 1)) * (w - 4) + 2,
        y: d * 0.55,
        z: h * 0.35 + exp + i * 0.4,
        w: slatW,
        d: 0.75,
        h: 22,
        mark: i === 0 ? letter(g.slats) : undefined,
      });
    }
    return boxes;
  }

  const { w, d, h, seatH, seatT, legW } = g;
  const exp = Math.max(w, d, h) * 0.2;
  const zStr = seatH * 0.32;
  const stT = 0.75;
  const stH = g.stretcherH;
  return [
    {
      x: -exp,
      y: d - legW + exp,
      z: 0,
      w: legW,
      d: legW,
      h,
      mark: letter(g.back),
    },
    { x: w - legW + exp, y: d - legW + exp, z: 0, w: legW, d: legW, h },
    {
      x: -exp,
      y: -exp,
      z: 0,
      w: legW,
      d: legW,
      h: Math.max(seatH - seatT, 8),
      mark: letter(g.front),
    },
    {
      x: w - legW + exp,
      y: -exp,
      z: 0,
      w: legW,
      d: legW,
      h: Math.max(seatH - seatT, 8),
    },
    {
      x: legW,
      y: -exp * 0.45,
      z: zStr,
      w: w - 2 * legW,
      d: stT,
      h: stH,
      mark: letter(g.stretcher),
    },
    {
      x: legW,
      y: d - stT + exp * 0.4,
      z: zStr,
      w: w - 2 * legW,
      d: stT,
      h: stH,
      mark: letter(findCut(g.cuts, /rear stretcher/i)),
    },
    {
      x: -exp * 0.35,
      y: legW,
      z: zStr,
      w: stT,
      d: d - 2 * legW,
      h: stH,
      mark: letter(findCut(g.cuts, /side stretcher/i)),
    },
    { x: w - stT + exp * 0.35, y: legW, z: zStr, w: stT, d: d - 2 * legW, h: stH },
    {
      x: 0.4,
      y: 0.2,
      z: seatH + exp * 0.4,
      w: w - 0.8,
      d: d * 0.7,
      h: seatT,
      mark: letter(g.seat),
    },
    {
      x: legW,
      y: d - stT + exp * 0.65,
      z: h + exp * 0.12,
      w: w - 2 * legW,
      d: stT,
      h: g.topRailH,
      mark: letter(g.topRail),
    },
    {
      x: legW,
      y: d - stT + exp * 0.5,
      z: seatH + 1,
      w: w - 2 * legW,
      d: stT,
      h: g.botRailH,
      mark: letter(g.botRail),
    },
    {
      x: w / 2 - 5,
      y: d + exp * 0.85,
      z: seatH + 3,
      w: 10,
      d: 0.4,
      h: 12,
      mark: letter(findCut(g.cuts, /lattice/i)),
    },
  ];
}

export function LatticeJoinery() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <figure>
        <svg viewBox="0 0 100 80" className="h-auto w-full" aria-hidden>
          <rect x="18" y="10" width="10" height="56" fill={WOOD} stroke={INK} strokeWidth="0.9" />
          <rect x="72" y="10" width="10" height="56" fill={WOOD} stroke={INK} strokeWidth="0.9" />
          <rect x="18" y="10" width="64" height="10" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
          <rect x="18" y="56" width="64" height="10" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
          <g fill="none" stroke={INK} strokeWidth="1.1">
            <path d="M28 20 L72 56" />
            <path d="M72 20 L28 56" />
            <path d="M28 38 L50 20 L72 38 L50 56 Z" />
          </g>
          <text
            x="50"
            y="76"
            textAnchor="middle"
            fontSize="4"
            fill={INK}
            fontFamily="IBM Plex Mono, monospace"
          >
            C · G + H · J
          </text>
        </svg>
        <figcaption className="text-sm text-ink-soft">
          C — {SHOP_PLAIN.stile}. G + H — {SHOP_PLAIN.rail}. J lattice lives in the opening, not
          on the seat. Cut strips long, mark the diamonds, then lap.
        </figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 100 80" className="h-auto w-full" aria-hidden>
          <rect x="16" y="28" width="68" height="10" fill={WOOD} stroke={INK} strokeWidth="0.9" />
          <rect x="45" y="12" width="10" height="56" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
          <rect x="45" y="28" width="10" height="10" fill={PAPER} stroke={INK} strokeWidth="0.7" />
          <text
            x="50"
            y="76"
            textAnchor="middle"
            fontSize="4"
            fill={INK}
            fontFamily="IBM Plex Mono, monospace"
          >
            Half-lap · faces flush
          </text>
        </svg>
        <figcaption className="text-sm text-ink-soft">
          Each crossing is a half-lap: half the ⅜" thickness out of each strip so the faces come
          flush. Glue and pin. Trim horns after it dries.
        </figcaption>
      </figure>
    </div>
  );
}
